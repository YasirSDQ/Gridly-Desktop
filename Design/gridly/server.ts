import express from "express";
import path from "path";
import cors from "cors";
import { spawn, execSync } from "child_process";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const RCLONE_CONFIG_PATH = path.join(process.cwd(), "rclone.conf");
const RCLONE_BIN = path.join(process.cwd(), "rclone");

// Touch config file to ensure it exists
if (!fs.existsSync(RCLONE_CONFIG_PATH)) {
  fs.writeFileSync(RCLONE_CONFIG_PATH, "");
}

// Kill any existing rclone processes before starting a new one to prevent port conflicts and orphans
try {
  execSync("pkill -f 'rclone rcd'");
} catch (e) {
  // Ignore errors if no process was found
}

// Start rclone rcd
const rcloneProcess = spawn(RCLONE_BIN, [
  "rcd",
  "--rc-no-auth",
  "--rc-addr=127.0.0.1:5572",
  "--rc-serve",
  "--config",
  RCLONE_CONFIG_PATH,
  "--server-side-across-configs",
  "--drive-server-side-across-configs",
  "--rc-job-expire-duration=2h",
  "--rc-job-expire-interval=2m",
  "--drive-chunk-size=64M",
  "--drive-upload-cutoff=1000T",
  "--transfers=8",
  "--checkers=16",
  "--buffer-size=64M",
  "--drive-pacer-min-sleep=100ms",
  "--drive-pacer-burst=100",
  "--fast-list",
  "-vv" // Add double verbose to trace
]);

const logStream = fs.createWriteStream('rclone.log', {flags: 'a'});
rcloneProcess.stdout.pipe(logStream);
rcloneProcess.stderr.pipe(logStream);

// Automatically ensure rclone RC has ServerSideAcrossConfigs enabled
const initRcloneOptions = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch("http://127.0.0.1:5572/options/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          main: {
            ServerSideAcrossConfigs: true,
            Transfers: 8,
            Checkers: 16
          }
        })
      });
      if (res.ok) {
        console.log("rclone ServerSideAcrossConfigs enabled in options");
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
};
initRcloneOptions();

rcloneProcess.on("error", (err) => {
  console.error("Failed to start rclone rcd:", err);
});

rcloneProcess.on("close", (code) => {
  console.log(`rclone rcd exited with code ${code}`);
});

// High-speed directory cache for operations/list to make browsing instantaneous
interface CacheEntry {
  data: any;
  status: number;
  timestamp: number;
}
const listCache = new Map<string, CacheEntry>();

app.post("/api/cache/clear", (req, res) => {
  listCache.clear();
  res.json({ status: "ok", message: "Server list cache cleared" });
});

// Basic proxy for rclone RC with smart caching & zero-latency navigation
app.use("/api/rc", async (req, res) => {
  const rcPath = req.url.replace(/^\//, '').split('?')[0]; // Express sub-app routing strips /api/rc
  const isList = rcPath === 'operations/list';
  const isRefresh = req.headers['x-refresh'] === 'true';
  const cacheKey = isList ? JSON.stringify(req.body) : '';

  // Return cached directory listing if within 25 seconds and not force refresh
  if (isList && !isRefresh) {
    const cached = listCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 25000)) {
      return res.status(cached.status).json(cached.data);
    }
  }

  // If mutation operation, invalidate directory cache
  if ([
    'operations/copyfile',
    'operations/movefile',
    'operations/deletefile',
    'operations/purge',
    'operations/mkdir',
    'sync/copy',
    'sync/move',
    'sync/sync'
  ].includes(rcPath)) {
    listCache.clear();
  }

  try {
    const rcUrl = `http://127.0.0.1:5572/${rcPath}`;
    const rcRes = await fetch(rcUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await rcRes.json();

    if (isList && rcRes.ok) {
      listCache.set(cacheKey, {
        data,
        status: rcRes.status,
        timestamp: Date.now()
      });
    }

    res.status(rcRes.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to proxy to rclone RC", details: err.message });
  }
});

// Proxy for streaming media natively from rclone rcd via HTTP
app.use("/api/stream/:remote/*all", (req, res, next) => {
  const remote = req.params.remote;
  const remoteClean = remote.replace(/:$/, '');
  const filePathArray = req.params.all || [];
  const filePath = Array.isArray(filePathArray) ? filePathArray : [filePathArray];
  
  // Rclone expects exactly /[remote:]/path/to/file for streaming
  // We need to ensure we encode the path segments properly but preserve slashes
  const encodedPath = filePath.map((seg: any) => encodeURIComponent(seg)).join('/');
  
  createProxyMiddleware({
    target: 'http://127.0.0.1:5572',
    changeOrigin: true,
    pathRewrite: (path, req) => {
      return `/[` + remoteClean + `:]/` + encodedPath;
    },
    onProxyReq: (proxyReq, req) => {
      // Forward range headers for video seeking
      if (req.headers.range) {
        proxyReq.setHeader('Range', req.headers.range);
      }
    }
  })(req, res, next);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

let activeAuthProcess: any = null;

app.post("/api/auth/start", async (req, res) => {
  if (activeAuthProcess) {
    activeAuthProcess.kill();
  }

  activeAuthProcess = spawn("./rclone", ["authorize", "drive", "--auth-no-open-browser"]);
  
  activeAuthProcess.on("error", (err: any) => {
    console.error("Failed to start rclone authorize:", err);
  });
  
  let returned = false;

  activeAuthProcess.stderr.on("data", async (data: Buffer) => {
    if (returned) return;
    const output = data.toString();
    const match = output.match(/http:\/\/127\.0\.0\.1:53682\/auth\?state=[a-zA-Z0-9_-]+/);
    if (match) {
      returned = true;
      try {
        const localUrl = match[0];
        const rcRes = await fetch(localUrl, { redirect: "manual" });
        const googleUrl = rcRes.headers.get("location");
        if (googleUrl) {
          res.json({ authUrl: googleUrl });
        } else {
          res.status(500).json({ error: "Could not extract Google OAuth URL" });
        }
      } catch (err: any) {
        res.status(500).json({ error: "Failed to fetch local auth URL" });
      }
    }
  });

  setTimeout(() => {
    if (!returned) {
      returned = true;
      res.status(500).json({ error: "Timeout waiting for rclone auth URL" });
      if (activeAuthProcess) activeAuthProcess.kill();
    }
  }, 10000);
});

app.post("/api/auth/callback", async (req, res) => {
  const { callbackUrl } = req.body;
  if (!callbackUrl || !callbackUrl.includes("state=") || !callbackUrl.includes("code=")) {
    return res.status(400).json({ error: "Invalid callback URL. Must contain state and code." });
  }

  if (!activeAuthProcess) {
    return res.status(400).json({ error: "No active auth process. Please start again." });
  }

  let returned = false;
  let tokenOutput = "";
  let errorOutput = "";

  activeAuthProcess.stdout.on("data", (data: Buffer) => {
    tokenOutput += data.toString();
  });
  
  activeAuthProcess.stderr.on("data", (data: Buffer) => {
    errorOutput += data.toString();
  });

  activeAuthProcess.on("close", () => {
    if (returned) return;
    returned = true;
    try {
      // Find the JSON block in the output (multi-line)
      const jsonMatch = tokenOutput.match(/\{[\s\S]*"access_token"[\s\S]*\}/);
      if (jsonMatch) {
        res.json({ token: jsonMatch[0] });
      } else {
        let errorMsg = "Failed to extract token from output.";
        if (errorOutput) {
          // Clean up the rclone help output to just show the error
          errorMsg = "Rclone Error: " + errorOutput.replace(/Usage:[\s\S]*/, '').trim();
        }
        res.status(500).json({ error: errorMsg, output: tokenOutput, stderr: errorOutput });
      }
    } catch (e) {
      res.status(500).json({ error: "Error parsing rclone output" });
    }
    activeAuthProcess = null;
  });

  try {
    // Send the callback to the local rclone server
    await fetch(callbackUrl);
  } catch (err: any) {
    // It might close the connection immediately upon success, which is fine.
    errorOutput += "\nFetch warn: " + err.message;
  }
  
  setTimeout(() => {
    if (!returned) {
      returned = true;
      res.status(500).json({ error: "Timeout waiting for rclone to generate token", stderr: errorOutput });
      if (activeAuthProcess) activeAuthProcess.kill();
      activeAuthProcess = null;
    }
  }, 10000);
});

app.post("/api/auth/new", async (req, res) => {
  const { name, tokenStr } = req.body;
  if (!name || !tokenStr) {
    return res.status(400).json({ error: "Name and token required" });
  }

  try {
    const parsed = JSON.parse(tokenStr);
    if (!parsed || typeof parsed !== 'object' || !parsed.access_token) { 
      return res.status(400).json({ error: "Invalid token structure." });
    }
    
    // Use rclone RC to create the remote so it is instantly available
    const rcUrl = `http://127.0.0.1:5572/config/create`;
    const rcRes = await fetch(rcUrl, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type: 'drive',
        parameters: {
          scope: 'drive',
          token: tokenStr,
          server_side_across_configs: 'true',
          config_is_local: 'false'
        }
      })
    });
    
    if (!rcRes.ok) {
      throw new Error(await rcRes.text());
    }
    
    res.json({ message: `Account ${name} added successfully.` });
  } catch (e: any) {
    return res.status(500).json({ error: "Failed to add account via RC", details: e.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gridly Core Engine running on port ${PORT}`);
  });
}

startServer();
