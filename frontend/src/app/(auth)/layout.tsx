export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* SYNAPSE Logo/Brand */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-500 via-cyan-500 to-violet-500 bg-clip-text text-transparent">
          SYNAPSE
        </h1>
        <p className="text-slate-400 mt-2">AI-Powered Technology Intelligence</p>
      </div>

      {/* Card Container */}
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
        {children}
      </div>
    </div>
  )
}
