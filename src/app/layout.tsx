import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'КО Salary — Система расчёта ЗП',
  description: 'Управление зарплатами коммерческого отдела',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
