'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, TrendingUp } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { cn, formatMoney, getDealStatusLabel, getDealStatusColor } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getForecastDeals } from '@/lib/supabase/queries'

const STATUS_ORDER = ['no_invoice', 'waiting_payment', 'paid']

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function ForecastPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        const activePeriod = await getActivePeriod(supabase)
        if (!activePeriod) { setLoading(false); return }
        setPeriod(activePeriod)

        // Manager sees own deals, ROP/director/admin see all
        const isManager = currentUser.role === 'manager'
        const data = await getForecastDeals(
          supabase,
          activePeriod.id,
          isManager ? currentUser.id : undefined
        )

        // For non-managers, enrich deals with user names
        if (!isManager && data.length > 0) {
          const userIds = Array.from(new Set(data.map((d: any) => d.user_id)))
          const { data: usersData } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', userIds)
          const userMap = new Map((usersData || []).map((u: any) => [u.id, u.full_name]))
          data.forEach((d: any) => { d.user_name = userMap.get(d.user_id) || '—' })
        }

        setDeals(data)
      } catch (err) {
        console.error('Forecast load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-brand-50"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
  }

  const monthName = period
    ? `${['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][period.month - 1]} ${period.year}`
    : '...'

  // Totals
  const totalRevenue = deals.reduce((s, d) => s + Number(d.revenue || 0), 0)
  const paidRevenue = deals.filter(d => d.status === 'paid').reduce((s, d) => s + Number(d.revenue || 0), 0)
  const unpaidRevenue = deals.filter(d => d.status !== 'paid').reduce((s, d) => s + Number(d.revenue || 0), 0)
  const totalUnits = deals.reduce((s, d) => s + (d.units || 0), 0)
  const paidUnits = deals.filter(d => d.status === 'paid').reduce((s, d) => s + (d.units || 0), 0)

  // Group by status
  const dealsByStatus = STATUS_ORDER.map(status => ({
    status,
    label: getDealStatusLabel(status),
    color: getDealStatusColor(status),
    deals: deals.filter(d => d.status === status),
    revenue: deals.filter(d => d.status === status).reduce((s, d) => s + Number(d.revenue || 0), 0),
    units: deals.filter(d => d.status === status).reduce((s, d) => s + (d.units || 0), 0),
  }))

  const showUserColumn = user?.role !== 'manager'

  return (
    <div className="flex min-h-screen bg-brand-50">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="w-6 h-6 text-brand-400" />
              <h1 className="font-heading text-2xl font-bold text-brand-900">Прогноз продаж</h1>
            </div>
            <p className="text-brand-500 text-sm">{monthName} • Все сделки текущего периода</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl bg-white border border-brand-100 shadow-sm p-4">
              <p className="text-xs text-brand-500 mb-1">Прогноз (все сделки)</p>
              <p className="text-2xl font-bold text-brand-900">{formatMoney(totalRevenue)}</p>
              <p className="text-[10px] text-brand-400 mt-0.5">{totalUnits} юнитов</p>
            </div>
            <div className="rounded-xl bg-white border border-brand-100 shadow-sm p-4">
              <p className="text-xs text-brand-500 mb-1">Оплачено</p>
              <p className="text-2xl font-bold text-emerald-600">{formatMoney(paidRevenue)}</p>
              <p className="text-[10px] text-brand-400 mt-0.5">{paidUnits} юнитов</p>
            </div>
            <div className="rounded-xl bg-white border border-brand-100 shadow-sm p-4">
              <p className="text-xs text-brand-500 mb-1">Ожидает оплаты</p>
              <p className="text-2xl font-bold text-amber-600">{formatMoney(unpaidRevenue)}</p>
              <p className="text-[10px] text-brand-400 mt-0.5">{totalUnits - paidUnits} юнитов</p>
            </div>
            <div className="rounded-xl bg-white border border-brand-100 shadow-sm p-4">
              <p className="text-xs text-brand-500 mb-1">Конверсия</p>
              <p className="text-2xl font-bold text-brand-900">
                {totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0}%
              </p>
              <p className="text-[10px] text-brand-400 mt-0.5">оплачено / прогноз</p>
            </div>
          </div>

          {/* Deals by status */}
          {dealsByStatus.map(group => {
            if (group.deals.length === 0) return null
            return (
              <div key={group.status} className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', group.color)}>
                    {group.label}
                  </span>
                  <span className="text-sm text-brand-500">
                    {group.deals.length} сделок • {formatMoney(group.revenue)}
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-brand-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-100 bg-brand-50">
                        {showUserColumn && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Менеджер</th>}
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Клиент</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Выручка</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">MRR</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Юниты</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Маржа обор.</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">План. оплата</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Заметки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.deals.map((deal: any) => (
                        <tr key={deal.id} className="border-b border-brand-50 hover:bg-brand-50/50 transition">
                          {showUserColumn && (
                            <td className="px-4 py-3 text-brand-800 font-medium">{deal.user_name || '—'}</td>
                          )}
                          <td className="px-4 py-3 text-brand-900 font-medium">{deal.client_name}</td>
                          <td className="px-4 py-3 text-right text-brand-900 font-medium">{formatMoney(deal.revenue)}</td>
                          <td className="px-4 py-3 text-right text-brand-500">{deal.mrr ? formatMoney(deal.mrr) : '—'}</td>
                          <td className="px-4 py-3 text-center text-brand-700">{deal.units}</td>
                          <td className="px-4 py-3 text-right text-brand-500">
                            {deal.equipment_margin > 0 ? formatMoney(deal.equipment_margin) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-brand-500">{formatDate(deal.planned_payment_date)}</td>
                          <td className="px-4 py-3 text-brand-400 text-xs truncate max-w-[200px]">{deal.notes || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {deals.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              Нет сделок в текущем периоде
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
