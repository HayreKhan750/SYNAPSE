import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'
import '@/styles/globals.css'
import 'katex/dist/katex.min.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'SYNAPSE', template: '%s | SYNAPSE' },
  description: 'AI-Powered Technology Intelligence Platform',
  keywords: ['AI', 'technology', 'intelligence', 'machine learning'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full overflow-hidden">
      <body className={`${inter.variable} h-full overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-300`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
