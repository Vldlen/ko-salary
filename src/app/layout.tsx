import type { Metadata } from 'next'
import { Inter, Unbounded } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
})

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-unbounded',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Пульс КО',
  description: 'Пульс коммерческого отдела',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={`${inter.variable} ${unbounded.variable}`}>
      <body className="bg-mesh min-h-screen">{children}</body>
    </html>
  )
}
