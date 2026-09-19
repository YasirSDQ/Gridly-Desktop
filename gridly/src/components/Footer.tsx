export default function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-indigo-500/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 flex items-center justify-center">
                <i className="fa-solid fa-cubes text-white text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  Gridly
                </h3>
                <p className="text-[10px] text-slate-500 tracking-wider">ADVANCED DRIVE MANAGER</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The most advanced Google Drive management tool powered by rclone. 
              Transfer, sync, and manage your cloud storage effortlessly.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {['fa-github', 'fa-twitter', 'fa-discord', 'fa-reddit'].map((icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-500/20 transition-all">
                  <i className={`fa-brands ${icon} text-sm`} />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              {['Features', 'Dashboard', 'Transfers', 'Pricing', 'Changelog'].map((item, i) => (
                <li key={i}>
                  <a href="#" className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              {['Documentation', 'rclone Guide', 'API Reference', 'Blog', 'Community'].map((item, i) => (
                <li key={i}>
                  <a href="#" className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              {['About', 'Privacy Policy', 'Terms of Service', 'Security', 'Contact'].map((item, i) => (
                <li key={i}>
                  <a href="#" className="text-sm text-slate-400 hover:text-indigo-400 transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © 2026 Gridly. All rights reserved. Built with ❤️ and rclone.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400">All systems operational</span>
            </div>
            <span className="text-xs text-slate-600">v2.4.1</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
