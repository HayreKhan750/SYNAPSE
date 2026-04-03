import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import '@/styles/globals.css'
import 'katex/dist/katex.min.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Viewport config must be a separate export in Next.js 14+
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#6366f1',
}

export const metadata: Metadata = {
  title: { default: 'SYNAPSE', template: '%s | SYNAPSE' },
  description: 'AI-Powered Technology Intelligence Platform — discover, research, and automate with AI.',
  keywords: ['AI', 'technology', 'intelligence', 'machine learning', 'research', 'automation'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SYNAPSE',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192x192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${inter.variable} h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300`}>
        <ServiceWorkerRegistration />
        <Providers>{children}</Providers>
        {/* TASK-104-3: Portal root for React modal portals */}
        <div id="modal-root" />
      </body>
    </html>
  )
}
