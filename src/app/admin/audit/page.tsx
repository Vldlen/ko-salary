'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ScrollText } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import { getAuditLog } from '@/lib/audit'

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_created: { label: 'Создание сотрудника', color: 'text-green-400' },
  user_deleted: { label: 'Удаление сотрудника', color: 'text-red-400' },
  user_blocked: { label: 'Блокировка', color: 'text-orange-400' },
  user_unblocked: { label: 'Разблокировка', color: 'text-green-400' },
  user_fired: { label: 'Увольнение', color: 'text-red-400' },
  user_edited: { label: 'Редактирование', color: 'text-blue-400' },
  password_reset: { label: 'Смена пароля', color: 'text-orange-400' },
  period_created: { label: 'Создание периода', color: 'text-blue-400' },
  period_closed: { label: 'Закрытие периода', color: 'text-emerald-400' },
  plan_updated: { label: 'Обновление плана', color: 'text-blue-400' },
  schema_created: { label: 'Создание схемы', color: 'text-blue-400' },
  schema_updated: { label: 'Обновление схемы', color: 'text-blue-400' },
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        if (currentUser.role !== 'admin') { router.push('/dashboard'); return }
        setUser(currentUser)

        const data = await getAuditLog(supabase, 200)
        setLogs(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  }

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={user?.role || 'admin'} userName={user?.full_name || ''} companyName="" />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <ScrollText className="w-7 h-7 text-blue-400" />
            <h1 className="text-2xl font-heading font-bold text-white">Журнал действий</h1>
            <span className="text-sm text-white/50 bg-white/10 px-2 py-0.5 rounded-full">{logs.length}</span>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-white/40">Пока нет записей</div>
            ) : (
              <div className="divide-y divide-white/5">
                {logs.map((log: any) => {
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'text-white/50' }
                  const details = log.details || {}
                  return (
                    <div key={log.id} className="px-5 py-3 flex items-center gap-4 hover:bg-white/5 transition">
                      <div className="text-xs text-white/30 w-36 shrink-0">
                        {formatDateTime(log.created_at)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-sm font-medium', actionInfo.color)}>
                          {actionInfo.label}
                        </span>
                        {details.target_name && (
                          <span className="text-sm text-white/70 ml-2">— {details.target_name}</span>
                        )}
                      </div>
                      <div className="text-xs text-white/30 shrink-0">
                        {log.actor?.full_name || '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
