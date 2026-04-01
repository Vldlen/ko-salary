'use client'

import { Monitor } from 'lucide-react'
import Link from 'next/link'

interface MobileRestrictedProps {
  children: React.ReactNode
}

export default function MobileRestricted({ children }: MobileRestrictedProps) {
  return (
    <>
      {/* Mobile: заглушка */}
      <div className="lg:hidden min-h-screen flex items-center justify-center p-6">
        <div className="glass-strong rounded-2xl p-8 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-5">
            <Monitor className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-lg font-heading font-bold text-white mb-2">
            Только на компьютере
          </h2>
          <p className="text-white/50 text-sm mb-6">
            Эта страница недоступна в мобильной версии. Откройте её на своём компьютере.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium text-sm px-5 py-2.5 rounded-xl transition"
          >
            Вернуться на дашборд
          </Link>
        </div>
      </div>

      {/* Desktop: обычный контент */}
      <div className="hidden lg:block">
        {children}
      </div>
    </>
  )
}
