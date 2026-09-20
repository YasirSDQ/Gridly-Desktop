import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function LandingPage() {
  const { dispatch, setView } = useApp()

  const handleConnect = () => {
    dispatch({ type: 'SET_AUTH_MODAL', payload: true })
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center overflow-hidden w-full pt-16">
      
      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], x: [0, -50, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/30 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], x: [0, 30, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] left-[40%] w-[30%] h-[30%] bg-cyan-600/20 rounded-full blur-[100px]"
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-white/10 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-slate-300">Gridly Next-Gen Beta</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-6xl md:text-8xl font-black tracking-tight mb-8"
        >
          Your Cloud, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            Beautifully Managed.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="text-xl md:text-2xl text-slate-400 max-w-3xl mb-12 leading-relaxed"
        >
          Gridly is a modern, high-performance file manager. Connect your Google Drive accounts securely and experience cloud storage with advanced features and stunning design.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut", type: "spring" }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={handleConnect}
            className="group relative px-8 py-4 bg-white text-slate-950 font-bold rounded-2xl text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] flex items-center justify-center gap-3"
          >
            <span>Connect Account</span>
            <i className="fa-brands fa-google text-xl group-hover:rotate-12 transition-transform" />
          </button>
          
          <button
            onClick={() => setView('dashboard')}
            className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl text-lg hover:scale-105 transition-all flex items-center justify-center gap-3 backdrop-blur-md"
          >
            <span>Skip to Dashboard</span>
            <i className="fa-solid fa-arrow-right" />
          </button>
        </motion.div>
        
        {/* Features Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 w-full text-left"
        >
          {[
            { icon: "fa-bolt", title: "Lightning Fast", desc: "Built on top of rclone for maximum performance and reliability." },
            { icon: "fa-shield-halved", title: "Secure by Design", desc: "Your credentials stay local. Direct connection to cloud providers." },
            { icon: "fa-wand-magic-sparkles", title: "Modern Interface", desc: "Fluid animations, glassmorphism, and a beautiful dark theme." }
          ].map((feat, i) => (
            <div key={i} className="p-6 rounded-3xl glass-card border border-white/5 hover:border-white/20 transition-all hover:-translate-y-2 group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform group-hover:bg-indigo-500/20">
                <i className={`fa-solid ${feat.icon} text-2xl text-slate-300 group-hover:text-indigo-400 transition-colors`} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{feat.title}</h3>
              <p className="text-slate-400">{feat.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
