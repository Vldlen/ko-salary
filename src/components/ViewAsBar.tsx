'use client'

import { useState, useEffect } from 'react'
import { Eye, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useViewAs } from '@/lib/view-as-context'

interface ViewAsBarProps {
  userRole: string
}

export default function ViewAsBar({ userRole }: ViewAsBarProps) {
  const { viewAsUser, selectManager, resetView, managers, loadManagers, managersLoaded } = useViewAs()
  const [showPicker, setShowPicker] = useState(false)

  const canViewAs = ['admin', 'director', 'rop', 'founder'].includes(userRole)

  useEffect(() => {
    if (canViewAs && !managersLoaded) {
      loadManagers()
    }
  }, [canViewAs, managersLoaded, loadManagers])

  if (!canViewAs) return null

  return (
    <div className="glass rounded-2xl p-3 mb-6 flex items-center justify-between relative z-50">
      <div className="flex items-center gap-3">
        <Eye className="w-4 h-4 text-blue-400" />
        <span className="text-sm text-white/50">Просмотр:</span>
        {viewAsUser ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-[9px]">
              {viewAsUser.full_name.charAt(0)}
            </div>
            <span className="text-sm font-semibold text-white">{viewAsUser.full_name}</span>
            <span className="text-xs text-white/30">{viewAsUser.company?.name}</span>
            <button onClick={resetView} className="ml-1 text-white/30 hover:text-white/60 transition p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-sm text-white/30">свои данные</span>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          Выбрать менеджера
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showPicker && 'rotate-180')} />
        </button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowPicker(false)} />
            <div className="absolute right-0 top-full mt-2 z-[100] bg-[#1a1f35] rounded-xl shadow-2xl w-72 max-h-80 overflow-y-auto border border-white/15 backdrop-blur-none">
              {managers.length === 0 ? (
                <div className="p-4 text-sm text-white/30 text-center">Нет активных менеджеров</div>
              ) : (
                managers.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => { selectManager(m); setShowPicker(false) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition',
                      viewAsUser?.id === m.id && 'bg-blue-500/10'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                      {m.full_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.full_name}</p>
                      <p className="text-[10px] text-white/30">{m.company?.name} · {m.position?.name || '—'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
