export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="
      min-h-screen flex flex-col items-center justify-center p-4
      bg-gradient-to-br from-indigo-50 via-white to-violet-50
      dark:from-slate-900 dark:via-slate-800 dark:to-slate-900
    ">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/40 dark:bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-200/40 dark:bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-100/20 dark:bg-cyan-900/5 rounded-full blur-3xl" />
      </div>

      {/* SYNAPSE Brand */}
      <div className="relative mb-10 text-center">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
            <span className="text-white font-black text-lg">S</span>
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 dark:from-indigo-400 dark:via-cyan-400 dark:to-violet-400 bg-clip-text text-transparent tracking-tight">
            SYNAPSE
          </h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          AI-Powered Technology Intelligence
        </p>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/80 dark:shadow-black/40 border border-slate-200 dark:border-slate-700/60 p-8">
        {children}
      </div>

      {/* Footer */}
      <p className="relative mt-8 text-xs text-slate-400 dark:text-slate-600">
        © {new Date().getFullYear()} SYNAPSE. All rights reserved.
      </p>
    </div>
  )
}
