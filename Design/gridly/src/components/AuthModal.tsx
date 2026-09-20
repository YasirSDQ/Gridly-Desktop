import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { generateId } from '../services/storage'
import * as rcloneRC from '../services/rcloneRC'

export default function AuthModal() {
  const { state, dispatch, addToast } = useApp()
  const [remoteName, setRemoteName] = useState('')
  const [callbackUrl, setCallbackUrl] = useState('')
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)

  if (!state.authModalOpen) return null

  const handleGenerateCode = async () => {
    try {
      setLoadingCode(true)
      const res = await fetch('/api/auth/start', { method: 'POST' })
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error(`Server returned invalid response: ${text.substring(0, 100) || 'Empty body'} (${res.status})`);
      }
      
      if (res.ok && data.authUrl) {
        window.open(data.authUrl, '_blank')
        addToast('success', 'Auth Started', 'Please complete the login in the new tab, then copy the final URL from the address bar (even if it says Site Cannot Be Reached) and paste it below.')
      } else {
        throw new Error(data.error || 'Failed to generate auth URL')
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setLoadingCode(false)
    }
  }

  const handleSubmitUrl = async () => {
    if (!remoteName) {
      addToast('error', 'Error', 'Please enter a Remote Name first')
      return
    }
    if (!callbackUrl) {
      addToast('error', 'Error', 'Please paste the Code URL or Token')
      return
    }

    try {
      setLoadingSubmit(true)
      
      let tokenStr = callbackUrl;
      
      // Check if user pasted raw JSON token
      let isRawJson = false;
      let parsedToken: any = null;
      
      // Try to fix truncated JSON (user probably missed the last '}' or '"}')
      let attemptToken = callbackUrl.trim();
      
      if (attemptToken.startsWith('{') && attemptToken.includes('"access_token"')) {
         try {
           parsedToken = JSON.parse(attemptToken);
           isRawJson = true;
         } catch (e) {
           // Try adding closing quotes/braces
           try {
             if (attemptToken.endsWith('"')) {
               parsedToken = JSON.parse(attemptToken + '}');
             } else {
               parsedToken = JSON.parse(attemptToken + '"}');
             }
             isRawJson = true;
             tokenStr = JSON.stringify(parsedToken);
             addToast('info', 'Token Fixed', 'We automatically fixed your truncated JSON token.');
           } catch (e2) {
             throw new Error('You pasted a JSON token, but it seems cut off or invalid. Please copy the entire JSON block carefully.');
           }
         }
      }

      if (!isRawJson) {
        // 1. Submit callback URL to get the token JSON
        const cbRes = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callbackUrl })
        })
        const cbText = await cbRes.text();
        let cbData: any = {};
        try {
          cbData = cbText ? JSON.parse(cbText) : {};
        } catch (e) {
          throw new Error(`Callback failed: ${cbText.substring(0, 100) || 'Empty body'} (${cbRes.status})`);
        }
        
        if (!cbRes.ok) {
          throw new Error(cbData.error || 'Failed to process callback URL')
        }
        tokenStr = cbData.token
      }

      // 2. Add the remote using the token
      const addRes = await fetch('/api/auth/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: remoteName, tokenStr })
      })
      const addText = await addRes.text();
      let addData: any = {};
      try {
        addData = addText ? JSON.parse(addText) : {};
      } catch (e) {
        throw new Error(`Add failed: ${addText.substring(0, 100) || 'Empty body'} (${addRes.status})`);
      }

      if (!addRes.ok) {
        throw new Error(addData.error || 'Failed to add account')
      }
      
      // 3. Wait a moment for rclone config to sync internally
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 4. Fetch real storage info from rclone RC!
      let usedBytes = 0;
      let totalBytes = 0;
      let fileCount = 0;
      let folderCount = 0;
      
      const fs = `${remoteName}:`;
      try {
        const about = await rcloneRC.getAbout(fs);
        usedBytes = about.used || 0;
        totalBytes = about.total || 0;
      } catch (error) {
        console.warn("Could not get storage info (about):", error);
      }
      
      try {
        const rootFiles = await rcloneRC.listFiles(fs, '', { recurse: false });
        fileCount = rootFiles.list?.filter((f: any) => !f.IsDir).length || 0;
        folderCount = rootFiles.list?.filter((f: any) => f.IsDir).length || 0;
      } catch (error) {
        console.warn("Could not list root files:", error);
      }

      addToast('success', 'Account Connected!', `Remote ${remoteName} has been added successfully`)
      dispatch({ type: 'SET_AUTH_MODAL', payload: false })
      dispatch({ type: 'SET_VIEW', payload: 'dashboard' })
      
      const newAccountId = generateId();
      dispatch({ type: 'ADD_ACCOUNT', payload: {
        id: newAccountId,
        name: remoteName,
        email: `${remoteName}@drive.rclone`,
        accessToken: '',
        refreshToken: '',
        tokenExpiry: 0,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(remoteName)}&background=6366f1&color=fff&size=128`,
        usedBytes,
        totalBytes,
        fileCount,
        folderCount,
        lastSynced: Date.now(),
        rcloneRemote: remoteName,
        status: 'connected',
        addedAt: Date.now()
      }})
      dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: newAccountId })

    } catch (err: any) {
      addToast('error', 'Connection Failed', err.message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  const handleClose = () => {
    dispatch({ type: 'SET_AUTH_MODAL', payload: false })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl glass-card overflow-hidden shadow-2xl animate-slide-up">
        
        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
              <i className="fa-brands fa-google-drive text-indigo-400 text-xl" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Connect Google Drive</h3>
              <p className="text-xs text-slate-400">using rclone headless auth</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Remote Name (e.g., mydrive)
            </label>
            <input
              type="text"
              value={remoteName}
              onChange={(e) => setRemoteName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder="Enter remote name"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
            <p className="text-rose-400 text-sm font-medium">Please Paste the Code URL, Follow Below Steps</p>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 text-center space-y-6">
            
            <div className="space-y-4">
              <input
                type="text"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="Enter Login URL (http://...) or JSON Token"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all text-sm"
              />
              <button
                onClick={handleSubmitUrl}
                disabled={loadingSubmit || !callbackUrl || !remoteName}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-600 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-500/25"
              >
                {loadingSubmit ? 'SUBMITTING...' : 'SUBMIT CODE URL'}
              </button>
            </div>

            <div className="border-t border-slate-700/50 pt-6">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center justify-center gap-2">
                <i className="fa-solid fa-bolt text-yellow-400" />
                Click on Button to Get Login Code
                <i className="fa-solid fa-bolt text-yellow-400" />
              </h4>
              <button
                onClick={handleGenerateCode}
                disabled={loadingCode}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-lg shadow-rose-600/25"
              >
                {loadingCode ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2" /> GENERATING...</>
                ) : (
                  <><i className="fa-solid fa-code mr-2" /> CLICK HERE GENERATE LOGIN CODE</>
                )}
              </button>
            </div>
            
            <div className="text-left text-xs text-slate-400 mt-4 space-y-2">
              <p>1. Click the <span className="text-rose-400">Generate Login Code</span> button above.</p>
              <p>2. A new tab will open Google's login page. Approve access.</p>
              <p>3. You will be redirected to an empty or error page (127.0.0.1).</p>
              <p>4. <b>Copy the entire URL</b> from your browser's address bar.</p>
              <p>5. Paste it into the input field above and click Submit.</p>
            </div>
            
          </div>

        </div>
      </div>
    </div>
  )
}
