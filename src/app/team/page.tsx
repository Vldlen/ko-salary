'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Users } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import StatCard from '@/components/StatCard'
import ProgressBar from '@/components/ProgressBar'
import { formatMoney, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getTeamProgress } from '@/lib/supabase/queries'

export default function TeamPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        // Only ROP/Director/Admin can view team
        if (!['rop', 'director', 'admin'].includes(currentUser.role)) {
          router.push('/dashboard')
          return
        }

        const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
        if (!activePeriod) { setLoading(false); return }

        const teamData = await getTeamProgress(supabase, currentUser.company_id, activePeriod.id)
        setTeam(teamData)
      } catch (err) {
        console.error('Team load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    )
  }

  const totalRev = team.reduce((s, m) => s + m.revenue_fact, 0)
  const totalPlan = team.reduce((s, m) => s + m.revenue_plan, 0)
  const avgRevPct = totalPlan > 0 ? Math.round((totalRev / totalPlan) * 100) : 0
  const totalUnits = team.reduce((s, m) => s + m.units_fact, 0)
  const totalUp = team.reduce((s, m) => s + m.units_plan, 0)
  const totalMeet = team.reduce((s, m) => s + m.meetings_fact, 0)
  const totalMp = team.reduce((s, m) => s + m.meetings_plan, 0)

  return (
    <div className="flex min-h-screen bg-brand-50">
      <Sidebar role={user?.role || 'rop'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-heading font-bold text-brand-900 mb-6">Командный результат</h1>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard title="Общая выручка" value={formatMoney(totalRev)} subtitle={`план: ${formatMoney(totalPlan)}`} icon={Users} />
            <StatCard title="Выполнение плана" value={`${avgRevPct}%`} variant={avgRevPct >= 100 ? 'success' : 'accent'} icon={Users} />
            <StatCard title="Точки / план" value={`${totalUnits} / ${totalUp}`} subtitle={totalUp > 0 ? `${Math.round(totalUnits / totalUp * 100)}%` : ''} icon={Users} />
            <StatCard title="Встречи / план" value={`${totalMeet} / ${totalMp}`} subtitle={totalMp > 0 ? `${Math.round(totalMeet / totalMp * 100)}%` : ''} icon={Users} />
          </div>

          {/* Team progress summary */}
          <div className="bg-white rounded-2xl border border-brand-100 p-6 mb-6">
            <h2 className="text-lg font-heading font-semibold text-brand-900 mb-4">Общий прогресс</h2>
            <div className="space-y-4">
              <ProgressBar label="Выручка команды" value={totalRev} max={totalPlan} percent={avgRevPct} formatValue={formatMoney} />
              <ProgressBar label="Точки подключения" value={totalUnits} max={totalUp} percent={totalUp > 0 ? Math.round(totalUnits / totalUp * 100) : 0} />
              <ProgressBar label="Встречи" value={totalMeet} max={totalMp} percent={totalMp > 0 ? Math.round(totalMeet / totalMp * 100) : 0} />
            </div>
          </div>

          {/* Individual cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {team.map(m => {
              const revPct = m.revenue_plan > 0 ? Math.round((m.revenue_fact / m.revenue_plan) * 100) : 0
              const unitsPct = m.units_plan > 0 ? Math.round((m.units_fact / m.units_plan) * 100) : 0
              const meetPct = m.meetings_plan > 0 ? Math.round((m.meetings_fact / m.meetings_plan) * 100) : 0
              const status = revPct >= 100
                ? { label: 'По плану', cls: 'bg-green-100 text-green-700' }
                : revPct >= 60
                  ? { label: 'Отстаёт', cls: 'bg-yellow-100 text-yellow-700' }
                  : { label: 'Риск', cls: 'bg-red-100 text-red-700' }

              return (
                <div key={m.id} className="bg-white rounded-2xl border border-brand-100 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold">
                        {m.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-brand-900">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.position}</p>
                      </div>
                    </div>
                    <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', status.cls)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <ProgressBar label="Выручка" value={m.revenue_fact} max={m.revenue_plan} percent={revPct} formatValue={formatMoney} />
                    <ProgressBar label="Точки" value={m.units_fact} max={m.units_plan} percent={unitsPct} />
                    <ProgressBar label="Встречи" value={m.meetings_fact} max={m.meetings_plan} percent={meetPct} />
                  </div>
                </div>
              )
            })}
          </div>

          {team.length === 0 && (
            <div className="text-center text-gray-400 py-12">Нет сотрудников в команде</div>
          )}
        </div>
      </main>
    </div>
  )
}
