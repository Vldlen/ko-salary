'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Loader2, X, Pencil, Trash2, Check } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { formatMoney, getDealStatusLabel, getDealStatusColor, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getDeals, createDeal, updateDeal } from '@/lib/supabase/queries'

const STATUS_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'no_invoice', label: 'Нет счёта' },
  { key: 'waiting_payment', label: 'Жду оплату' },
  { key: 'paid', label: 'Оплачено' },
]

const STATUS_OPTIONS = [
  { value: 'no_invoice', label: 'Нет счёта' },
  { value: 'waiting_payment', label: 'Жду оплату' },
  { value: 'paid', label: 'Оплачено' },
]

const EMPTY_FORM = {
  client_name: '',
  revenue: '',
  mrr: '',
  units: '1',
  equipment_sell_price: '',
  equipment_buy_price: '',
  status: 'no_invoice',
  notes: '',
}

function calcMargin(sellPrice: string, buyPrice: string): number {
  const sell = Number(sellPrice) || 0
  const buy = Number(buyPrice) || 0
  if (sell <= 0) return 0
  return Math.round(sell * 0.9 - buy)
}

export default function DealsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [deals, setDeals] = useState<any[]>([])
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const margin = calcMargin(form.equipment_sell_price, form.equipment_buy_price)
      const dealData = {
        client_name: form.client_name,
        revenue: Number(form.revenue) || 0,
        mrr: Number(form.mrr) || 0,
        units: Number(form.units) || 1,
        equipment_sell_price: Number(form.equipment_sell_price) || 0,
        equipment_buy_price: Number(form.equipment_buy_price) || 0,
        equipment_margin: margin,
        status: form.status,
        notes: form.notes || '',
      }

      if (editingDeal) {
        await updateDeal(supabase, editingDeal.id, dealData)
      } else {
        await createDeal(supabase, {
          ...dealData,
          user_id: user.id,
          period_id: period.id,
        })
      }

      // Refresh
      const dealsData = await getDeals(supabase, user.id, period.id, selectedStatus)
      setDeals(dealsData)
      setShowForm(false)
      setEditingDeal(null)
      setForm(EMPTY_FORM)
    } catch (err: any) {
      setError(err.message || 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(dealId: string) {
    if (!confirm('Удалить сделку?')) return
    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId)
      if (error) throw error
      const dealsData = await getDeals(supabase, user.id, period.id, selectedStatus)
      setDeals(dealsData)
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления')
    }
  }

  function openEdit(deal: any) {
    setEditingDeal(deal)
    setForm({
      client_name: deal.client_name,
      revenue: String(Number(deal.revenue)),
      mrr: String(Number(deal.mrr)),
      units: String(deal.units),
      equipment_sell_price: String(Number(deal.equipment_sell_price || 0)),
      equipment_buy_price: String(Number(deal.equipment_buy_price || 0)),
      status: deal.status,
      notes: deal.notes || '',
    })
    setShowForm(true)
    setError('')
  }

  function openNew() {
    setEditingDeal(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setError('')
  }

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
  const totalMargin = filteredDeals.reduce((sum, deal) => sum + Number(deal.equipment_margin || 0), 0)
  const dealsCount = filteredDeals.length
  const averageCheck = dealsCount > 0 ? Math.round(totalRevenue / dealsCount) : 0

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

          {/* Stats */}
          <div className="mb-8 grid grid-cols-4 gap-4">
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Выручка</p>
              <p className="font-heading text-2xl font-bold text-brand-900 mt-2">{formatMoney(totalRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Точки</p>
              <p className="font-heading text-2xl font-bold text-brand-900 mt-2">{totalUnits}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Сделок</p>
              <p className="font-heading text-2xl font-bold text-brand-900 mt-2">{dealsCount}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-6">
              <p className="text-sm font-medium text-brand-500">Маржа обор.</p>
              <p className={cn("font-heading text-2xl font-bold mt-2", totalMargin > 0 ? 'text-green-600' : 'text-brand-900')}>{formatMoney(totalMargin)}</p>
            </div>
          </div>

          {/* Filters */}
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

          {/* New/Edit Deal Form */}
          {showForm && (
            <div className="mb-8 rounded-2xl border border-brand-100 bg-white p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-brand-900">
                  {editingDeal ? 'Редактировать сделку' : 'Новая сделка'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditingDeal(null); setForm(EMPTY_FORM) }}
                  className="rounded-lg p-2 text-brand-500 hover:bg-brand-50">
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleSave}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-brand-900 mb-1">Клиент *</label>
                    <input type="text" required value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      className="w-full rounded-xl border border-brand-100 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                      placeholder="Название компании" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-900 mb-1">Статус</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full rounded-xl border border-brand-100 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none bg-white">
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-brand-900 mb-1">Выручка</label>
                    <input type="number" value={form.revenue}
                      onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                      className="w-full rounded-xl border border-brand-100 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-900 mb-1">MRR</label>
                    <input type="number" value={form.mrr}
                      onChange={(e) => setForm({ ...form, mrr: e.target.value })}
                      className="w-full rounded-xl border border-brand-100 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-brand-900 mb-1">Точки</label>
                    <input type="number" value={form.units}
                      onChange={(e) => setForm({ ...form, units: e.target.value })}
                      className="w-full rounded-xl border border-brand-100 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                      placeholder="1" />
                  </div>
                </div>

                {/* Equipment block */}
                <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4">
                  <p className="text-sm font-semibold text-brand-900 mb-3">Оборудование</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-brand-500 mb-1">Цена продажи</label>
                      <input type="number" value={form.equipment_sell_price}
                        onChange={(e) => setForm({ ...form, equipment_sell_price: e.target.value })}
                        className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                        placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-brand-500 mb-1">Цена закупки</label>
                      <input type="number" value={form.equipment_buy_price}
                        onChange={(e) => setForm({ ...form, equipment_buy_price: e.target.value })}
                        className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                        placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-brand-500 mb-1">Маржа (авто)</label>
                      <div className={cn(
                        "w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm font-semibold",
                        calcMargin(form.equipment_sell_price, form.equipment_buy_price) > 0 ? 'text-green-600' :
                        calcMargin(form.equipment_sell_price, form.equipment_buy_price) < 0 ? 'text-red-600' : 'text-brand-500'
                      )}>
                        {formatMoney(calcMargin(form.equipment_sell_price, form.equipment_buy_price))}
                      </div>
                      <p className="text-xs text-brand-400 mt-1">продажа − 10% НДС − закупка</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-brand-900 mb-1">Заметки</label>
                  <input type="text" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-xl border border-brand-100 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none"
                    placeholder="Комментарий к сделке..." />
                </div>

                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {editingDeal ? 'Сохранить' : 'Создать сделку'}
                </button>
              </form>
            </div>
          )}

          {/* Deals Table */}
          <div className="mb-8 overflow-x-auto rounded-2xl border border-brand-100 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-brand-900">Клиент</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-brand-900">Выручка</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-brand-900">MRR</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-brand-900">Точки</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-brand-900">Оборудование</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-brand-900">Статус</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-brand-900">Дата</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-brand-900">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length > 0 ? filteredDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-brand-100 hover:bg-brand-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white bg-brand-500">
                          {deal.client_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-brand-900">{deal.client_name}</span>
                          {deal.notes && <p className="text-xs text-brand-500 mt-0.5">{deal.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-brand-900">{Number(deal.revenue) > 0 ? formatMoney(Number(deal.revenue)) : '—'}</td>
                    <td className="px-4 py-4 text-sm font-medium text-brand-900">{Number(deal.mrr) > 0 ? formatMoney(Number(deal.mrr)) : '—'}</td>
                    <td className="px-4 py-4 text-sm font-medium text-brand-900">{deal.units}</td>
                    <td className="px-4 py-4">
                      {Number(deal.equipment_sell_price) > 0 ? (
                        <div className="text-xs leading-relaxed">
                          <p className="text-brand-400">Продажа: <span className="text-brand-900 font-medium">{formatMoney(Number(deal.equipment_sell_price))}</span></p>
                          <p className="text-brand-400">Закупка: <span className="text-brand-900 font-medium">{formatMoney(Number(deal.equipment_buy_price))}</span></p>
                          <p className="text-brand-400">Маржа: <span className={cn('font-semibold', Number(deal.equipment_margin) > 0 ? 'text-green-600' : Number(deal.equipment_margin) < 0 ? 'text-red-600' : 'text-brand-900')}>{formatMoney(Number(deal.equipment_margin))}</span></p>
                        </div>
                      ) : <span className="text-sm text-brand-500">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-semibold', getDealStatusColor(deal.status))}>
                        {getDealStatusLabel(deal.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-brand-500">{formatDate(deal.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(deal)}
                          className="rounded-lg p-2 text-brand-500 hover:bg-brand-50 transition-colors"
                          title="Редактировать">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(deal.id)}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-50 transition-colors"
                          title="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-brand-500">Нет сделок</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add button */}
          {!showForm && (
            <button onClick={openNew}
              className="flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600">
              <Plus size={20} />
              Новая сделка
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
