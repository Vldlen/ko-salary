'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, TrendingUp, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ViewAsBar from '@/components/ViewAsBar'
import { cn, formatMoney, getDealStatusLabel, getDealStatusColor } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { useViewAs } from '@/lib/view-as-context'
import { getCurrentUser, getActivePeriod, getForecastDeals } from '@/lib/supabase/queries'

const FORECAST_STATUSES = ['no_invoice', 'waiting_payment']

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function ForecastPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const { viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs } = useViewAs()
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (status: string) => {
    setExpandedGroups(prev => ({ ...prev, [status]: !prev[status] }))
  }

  // Load current user once
  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
      } catch (err) {
        console.error('Forecast load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Load forecast data — re-runs when viewAsUser changes
  useEffect(() => {
    if (!user) return

    // Admin without viewAs — show empty (director/rop see own data)
    if (user.role === 'admin' && !isViewingAs) {
      setDeals([])
      setPeriod(null)
      return
    }

    const targetUserId = effectiveUserId(user.id)
    const targetCompanyId = effectiveCompanyId(user.company_id)

    async function loadForecast() {
      try {
        const activePeriod = await getActivePeriod(supabase, targetCompanyId)
        if (!activePeriod) { setPeriod(null); setDeals([]); return }
        setPeriod(activePeriod)

        // When viewing as a manager, load only their deals
        const data = await getForecastDeals(
          supabase,
          activePeriod.id,
          targetUserId
        )

        setDeals(data)
      } catch (err) {
        console.error('Forecast load error:', err)
      }
    }
    loadForecast()
  }, [supabase, user, viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  }

  const monthName = period
    ? `${['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][period.month - 1]} ${period.year}`
    : '...'

  // Only unpaid deals for forecast
  const forecastDeals = deals.filter(d => d.status !== 'paid')
  const paidDeals = deals.filter(d => d.status === 'paid')

  const forecastRevenue = forecastDeals.reduce((s, d) => s + Number(d.revenue || 0), 0)
  const forecastUnits = forecastDeals.reduce((s, d) => s + (d.units || 0), 0)
  const paidRevenue = paidDeals.reduce((s, d) => s + Number(d.revenue || 0), 0)
  const paidUnits = paidDeals.reduce((s, d) => s + (d.units || 0), 0)
  const totalRevenue = forecastRevenue + paidRevenue

  // Group by status (only forecast statuses)
  const dealsByStatus = FORECAST_STATUSES.map(status => ({
    status,
    label: getDealStatusLabel(status),
    color: getDealStatusColor(status),
    deals: deals.filter(d => d.status === status),
    revenue: deals.filter(d => d.status === status).reduce((s, d) => s + Number(d.revenue || 0), 0),
    units: deals.filter(d => d.status === status).reduce((s, d) => s + (d.units || 0), 0),
  }))

  const showUserColumn = !isViewingAs && user?.role !== 'manager'

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <ViewAsBar userRole={user?.role || 'manager'} />

          {/* Empty prompt for admin without viewAs */}
          {user?.role === 'admin' && !isViewingAs && (
            <div className="glass rounded-2xl p-12 text-center">
              <Eye className="w-12 h-12 text-white/15 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-white mb-2">Выберите менеджера</h2>
              <p className="text-sm text-white/40">Нажмите «Выбрать менеджера» чтобы просмотреть прогноз</p>
            </div>
          )}

          {(isViewingAs || user?.role !== 'admin') && (<>
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              <h1 className="font-heading text-2xl font-bold text-white">Прогноз продаж</h1>
            </div>
            <p className="text-blue-400 text-sm">
              {monthName} • {isViewingAs ? viewAsUser?.full_name : 'Неоплаченные сделки текущего периода'}
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Прогноз (неоплаченные)</p>
              <p className="text-2xl font-bold text-white">{formatMoney(forecastRevenue)}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">{forecastUnits} юнитов • {forecastDeals.length} сделок</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Уже оплачено</p>
              <p className="text-2xl font-bold text-emerald-600">{formatMoney(paidRevenue)}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">{paidUnits} юнитов • {paidDeals.length} сделок</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Итого если всё закроется</p>
              <p className="text-2xl font-bold text-blue-600">{formatMoney(totalRevenue)}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">
                {totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0}% уже оплачено
              </p>
            </div>
          </div>

          {/* Deals by status — collapsible */}
          {dealsByStatus.map(group => {
            if (group.deals.length === 0) return null
            const isExpanded = expandedGroups[group.status] ?? false

            return (
              <div key={group.status} className="mb-4">
                <button
                  onClick={() => toggleGroup(group.status)}
                  className="w-full flex items-center gap-3 py-3 px-4 glass rounded-xl hover:bg-white/5 transition"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-blue-400" />
                    : <ChevronRight className="w-4 h-4 text-blue-400" />
                  }
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', group.color)}>
                    {group.label}
                  </span>
                  <span className="text-sm font-medium text-white">
                    {formatMoney(group.revenue)}
                  </span>
                  <span className="text-sm text-blue-400">
                    {group.deals.length} сделок • {group.units} юнитов
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-2 glass rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          {showUserColumn && <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/50 uppercase">Менеджер</th>}
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/50 uppercase">Клиент</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-white/50 uppercase">Выручка</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-white/50 uppercase">MRR</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-white/50 uppercase">Юниты</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-white/50 uppercase">Маржа обор.</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-white/50 uppercase">План. оплата</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/50 uppercase">Заметки</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.deals.map((deal: any) => (
                          <tr key={deal.id} className="border-b border-white/5 hover:bg-white/5 transition">
                            {showUserColumn && (
                              <td className="px-4 py-3 text-white/80 font-medium">{deal.user_name || '—'}</td>
                            )}
                            <td className="px-4 py-3 text-white font-medium">{deal.client_name}</td>
                            <td className="px-4 py-3 text-right text-white font-medium">{formatMoney(deal.revenue)}</td>
                            <td className="px-4 py-3 text-right text-blue-400">{deal.mrr ? formatMoney(deal.mrr) : '—'}</td>
                            <td className="px-4 py-3 text-center text-white/80">{deal.units}</td>
                            <td className="px-4 py-3 text-right text-blue-400">
                              {deal.equipment_margin > 0 ? formatMoney(deal.equipment_margin) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center text-blue-400">{formatDate(deal.planned_payment_date)}</td>
                            <td className="px-4 py-3 text-blue-400 text-xs truncate max-w-[200px]">{deal.notes || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {forecastDeals.length === 0 && (
            <div className="text-center py-16 text-white/40">
              Нет неоплаченных сделок в текущем периоде
            </div>
          )}
          </>)}
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
