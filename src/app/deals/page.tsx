'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { formatMoney, getDealStatusLabel, getDealStatusColor, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getDeals } from '@/lib/supabase/queries'

const STATUS_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'prospect', label: 'Перспектива' },
  { key: 'negotiation', label: 'Переговоры' },
  { key: 'waiting_payment', label: 'Ждём оплату' },
  { key: 'paid', label: 'Оплачено' },
  { key: 'cancelled', label: 'Отменено' },
]

export default function DealsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [deals, setDeals] = useState<any[]>([])
  const [selectedStatus, setSelectedStatus] = useState('all')

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
        if (!activePeriod) { setLoading(false); return }
        setPeriod(activePeriod)

        const dealsData = await getDeals(supabase, currentUser.id, activePeriod.id)
        setDeals(dealsData)
      } catch (err) {
        console.error('Deals load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Re-fetch when filter changes
  useEffect(() => {
    if (!user || !period) return
    async function reload() {
      const dealsData = await getDeals(supabase, user.id, period.id, selectedStatus)
      setDeals(dealsData)
    }
    reload()
  }, [selectedStatus, user, period, supabase])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    )
  }

  const filteredDeals = deals
  const totalRevenue = filteredDeals.reduce((sum, deal) => sum + Number(deal.revenue), 0)
  const totalUnits = filteredDeals.reduce((sum, deal) => sum + deal.units, 0)
  const dealsCount = filteredDeals.length
  const averageCheck = dealsCount > 0 ? Math.round(filteredDeals.reduce((sum, deal) => sum + Number(deal.forecast_revenue || deal.revenue), 0) / dealsCount) : 0

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="flex h-screen bg-brand-50">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="font-heading text-3xl font-bold text-brand-900">Сделки</h1>
            <div className="flex items-center gap-2 rounded-lg border border-brand-100 bg-white px-4 py-2">
              <span className="text-sm font-medium text-brand-900">
                {period ? `${['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][period.month-1]} ${period.year}` : '...'}
              </span>
              <ChevronDown size={18} className="text-brand-400" />
            </div>
          </div>

          <div className="mb-8 grid grid-cols-4 gap-4">
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Выручка</p>
              <p className="font-heading text-2xl font-bold text-brand-900 mt-2">{formatMoney(totalRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Количество точек</p>
              <p className="font-heading text-2xl font-bold text-brand-900 mt-2">{totalUnits}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Сделок</p>
              <p className="font-heading text-2xl font-bold text-brand-900 mt-2">{dealsCount}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Средний чек</p>
              <p className="font-heading text-2xl font-bold text-brand-900 mt-2">{formatMoney(averageCheck)}</p>
            </div>
          </div>

          <div className="mb-8 flex items-center gap-2 overflow-x-auto rounded-2xl border border-brand-100 bg-white p-2">
            {STATUS_FILTERS.map((filter) => (
              <button key={filter.key} onClick={() => setSelectedStatus(filter.key)}
                className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  selectedStatus === filter.key ? 'bg-brand-500 text-white' : 'text-brand-500 hover:bg-brand-50'
                )}>
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mb-8 overflow-hidden rounded-2xl border border-brand-100 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">Клиент</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">Выручка</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">MRR</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">Точки</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">Маржа</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">Статус</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">Прогноз</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-900">Дата</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length > 0 ? filteredDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-brand-100 hover:bg-brand-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white bg-brand-500">
                          {deal.client_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium text-brand-900">{deal.client_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-brand-900">{Number(deal.revenue) > 0 ? formatMoney(Number(deal.revenue)) : '—'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-brand-900">{Number(deal.mrr) > 0 ? formatMoney(Number(deal.mrr)) : '—'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-brand-900">{deal.units}</td>
                    <td className="px-6 py-4 text-sm font-medium text-brand-900">{Number(deal.equipment_margin) > 0 ? formatMoney(Number(deal.equipment_margin)) : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-semibold', getDealStatusColor(deal.status))}>
                        {getDealStatusLabel(deal.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-brand-900">{formatMoney(Number(deal.forecast_revenue || deal.revenue))}</span>
                        {deal.is_forecast && <span className="inline-block h-2 w-2 rounded-full bg-accent" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-500">{formatDate(deal.created_at)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-brand-500">Нет сделок</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button className="flex items-center gap-2 rounded-2xl border-2 border-brand-500 bg-white px-6 py-3 font-medium text-brand-500 transition-colors hover:bg-brand-50">
            <Plus size={20} />
            Новая сделка
          </button>
        </div>
      </main>
    </div>
  )
}
