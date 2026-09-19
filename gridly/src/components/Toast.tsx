import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function Toast() {
  const { state, dispatch } = useApp()

  if (state.toasts.length === 0) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return 'fa-circle-check text-emerald-400'
      case 'error': return 'fa-circle-xmark text-rose-400'
      case 'warning': return 'fa-triangle-exclamation text-amber-400'
      case 'info': return 'fa-circle-info text-sky-400'
      default: return 'fa-circle-info text-sky-400'
    }
  }

  const getStyle = (type: string) => {
    switch (type) {
      case 'success': 
        return 'bg-emerald-950/80 border-emerald-500/30 shadow-emerald-950/40'
      case 'error': 
        return 'bg-rose-950/80 border-rose-500/30 shadow-rose-950/40'
      case 'warning': 
        return 'bg-amber-950/80 border-amber-500/30 shadow-amber-950/40'
      case 'info': 
        return 'bg-slate-900/90 border-indigo-500/30 shadow-indigo-950/40'
      default: 
        return 'bg-slate-900/90 border-slate-700/50 shadow-black/40'
    }
  }

  return (
    <div className="fixed top-20 right-5 z-[200] space-y-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {state.toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3.5 ${getStyle(toast.type)}`}
          >
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <i className={`fa-solid ${getIcon(toast.type)} text-base`} />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-white tracking-tight">{toast.title}</p>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words">{toast.message}</p>
              
              {toast.action && (
                <div className="mt-2.5">
                  <button
                    onClick={() => {
                      toast.action?.onClick()
                      dispatch({ type: 'REMOVE_TOAST', payload: toast.id })
                    }}
                    className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span>{toast.action.label}</span>
                    <i className="fa-solid fa-arrow-right text-[10px]" />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })}
              className="w-6 h-6 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
              title="Dismiss notification"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
