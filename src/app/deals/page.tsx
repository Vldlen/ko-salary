'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Loader2, X, Pencil, Trash2, Check, Calendar, Eye } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ViewAsBar from '@/components/ViewAsBar'
import { formatMoney, getDealStatusLabel, getDealStatusColor, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { useViewAs } from '@/lib/view-as-context'
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
  planned_payment_date: '',
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
  const { viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs } = useViewAs()
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

  // Payment date popup state
  const [paidPopup, setPaidPopup] = useState<{ dealId: string; rect: DOMRect } | null>(null)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))

  // Load current user once
  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
      } catch (err) {
        console.error('Deals load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Load deals — re-runs when viewAsUser changes
  useEffect(() => {
    if (!user) return
    const targetUserId = effectiveUserId(user.id)
    const targetCompanyId = effectiveCompanyId(user.company_id)

    // Admin/director/rop without viewAs — show empty
    if (['admin', 'director', 'rop'].includes(user.role) && !isViewingAs) {
      setDeals([])
      setPeriod(null)
      return
    }

    async function loadDeals() {
      try {
        const activePeriod = await getActivePeriod(supabase, targetCompanyId)
        if (!activePeriod) { setPeriod(null); setDeals([]); return }
        setPeriod(activePeriod)
        const dealsData = await getDeals(supabase, targetUserId, activePeriod.id, selectedStatus)
        setDeals(dealsData)
      } catch (err) {
        console.error('Deals load error:', err)
      }
    }
    loadDeals()
  }, [supabase, user, viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs, selectedStatus])

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
        planned_payment_date: form.planned_payment_date || null,
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
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
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
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
      setDeals(dealsData)
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления')
    }
  }

  async function handleStatusChange(dealId: string, newStatus: string, e?: React.MouseEvent) {
    if (newStatus === 'paid') {
      // Show date popup
      const rect = (e?.currentTarget as HTMLElement)?.getBoundingClientRect()
      setPaidPopup({ dealId, rect: rect || new DOMRect() })
      setPaidDate(new Date().toISOString().slice(0, 10))
      return
    }
    try {
      await updateDeal(supabase, dealId, { status: newStatus, paid_at: null })
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
      setDeals(dealsData)
    } catch (err: any) {
      alert(err.message || 'Ошибка смены статуса')
    }
  }

  async function confirmPaid() {
    if (!paidPopup) return
    try {
      await updateDeal(supabase, paidPopup.dealId, { status: 'paid', paid_at: paidDate })
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
      setDeals(dealsData)
      setPaidPopup(null)
    } catch (err: any) {
      alert(err.message || 'Ошибка')
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
      planned_payment_date: deal.planned_payment_date || '',
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
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
    <MobileRestricted>
    <div className="flex h-screen">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <ViewAsBar userRole={user?.role || 'manager'} />

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold text-white">Сделки</h1>
              {isViewingAs && <p className="text-white/40 text-sm mt-1">Сделки — {viewAsUser?.full_name}</p>}
            </div>
            <div className="flex items-center gap-2 rounded-lg glass px-4 py-2">
              <span className="text-sm font-medium text-white">
                {period ? `${['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][period.month-1]} ${period.year}` : '...'}
              </span>
              <ChevronDown size={18} className="text-blue-400" />
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-4 gap-4">
            <div className="rounded-2xl glass p-6">
              <p className="text-sm font-medium text-blue-400">Выручка</p>
              <p className="font-heading text-2xl font-bold text-white mt-2">{formatMoney(totalRevenue)}</p>
            </div>
            <div className="rounded-2xl glass p-6">
              <p className="text-sm font-medium text-blue-400">Точки</p>
              <p className="font-heading text-2xl font-bold text-white mt-2">{totalUnits}</p>
            </div>
            <div className="rounded-2xl glass p-6">
              <p className="text-sm font-medium text-blue-400">Сделок</p>
              <p className="font-heading text-2xl font-bold text-white mt-2">{dealsCount}</p>
            </div>
            <div className="rounded-2xl glass p-6">
              <p className="text-sm font-medium text-blue-400">Маржа обор.</p>
              <p className={cn("font-heading text-2xl font-bold mt-2", totalMargin > 0 ? 'text-green-600' : 'text-white')}>{formatMoney(totalMargin)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-8 flex items-center gap-2 overflow-x-auto rounded-2xl glass p-2">
            {STATUS_FILTERS.map((filter) => (
              <button key={filter.key} onClick={() => setSelectedStatus(filter.key)}
                className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  selectedStatus === filter.key ? 'bg-blue-500 text-white' : 'text-blue-400 hover:bg-white/5'
                )}>
                {filter.label}
              </button>
            ))}
          </div>

          {/* Empty prompt for admin without viewAs */}
          {['admin', 'director', 'rop'].includes(user?.role) && !isViewingAs && (
            <div className="glass rounded-2xl p-12 text-center">
              <Eye className="w-12 h-12 text-white/15 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-white mb-2">Выберите менеджера</h2>
              <p className="text-sm text-white/40">Нажмите «Выбрать менеджера» чтобы просмотреть его сделки</p>
            </div>
          )}

          {/* New/Edit Deal Form — only for managers */}
          {showForm && user?.role === 'manager' && !isViewingAs && (
            <div className="mb-8 rounded-2xl glass p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editingDeal ? 'Редактировать сделку' : 'Новая сделка'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditingDeal(null); setForm(EMPTY_FORM) }}
                  className="rounded-lg p-2 text-blue-400 hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleSave}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Клиент *</label>
                    <input type="text" required value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Название компании" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Статус</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none">
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Выручка</label>
                    <input type="number" value={form.revenue}
                      onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">MRR</label>
                    <input type="number" value={form.mrr}
                      onChange={(e) => setForm({ ...form, mrr: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Точки</label>
                    <input type="number" value={form.units}
                      onChange={(e) => setForm({ ...form, units: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="1" />
                  </div>
                </div>

                {/* Equipment block */}
                <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white mb-3">Оборудование</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-blue-400 mb-1">Цена продажи</label>
                      <input type="number" value={form.equipment_sell_price}
                        onChange={(e) => setForm({ ...form, equipment_sell_price: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                        placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-400 mb-1">Цена закупки</label>
                      <input type="number" value={form.equipment_buy_price}
                        onChange={(e) => setForm({ ...form, equipment_buy_price: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                        placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-400 mb-1">Маржа (авто)</label>
                      <div className={cn(
                        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white",
                        calcMargin(form.equipment_sell_price, form.equipment_buy_price) > 0 ? 'text-green-600' :
                        calcMargin(form.equipment_sell_price, form.equipment_buy_price) < 0 ? 'text-red-600' : 'text-blue-400'
                      )}>
                        {formatMoney(calcMargin(form.equipment_sell_price, form.equipment_buy_price))}
                      </div>
                      <p className="text-xs text-blue-400 mt-1">продажа − 10% НДС − закупка</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Планируемая дата оплаты</label>
                    <input type="date" value={form.planned_payment_date}
                      onChange={(e) => setForm({ ...form, planned_payment_date: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-1">Заметки</label>
                  <input type="text" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Комментарий к сделке..." />
                </div>

                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {editingDeal ? 'Сохранить' : 'Создать сделку'}
                </button>
              </form>
            </div>
          )}

          {/* Deals Table */}
          <div className="mb-8 overflow-x-auto rounded-2xl glass">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Клиент</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Выручка</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">MRR</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Точки</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Оборудование</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Статус</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Дата</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-white">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length > 0 ? filteredDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white bg-blue-500">
                          {deal.client_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white">{deal.client_name}</span>
                          {deal.notes && <p className="text-xs text-blue-400 mt-0.5">{deal.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-white">{Number(deal.revenue) > 0 ? formatMoney(Number(deal.revenue)) : '—'}</td>
                    <td className="px-4 py-4 text-sm font-medium text-white">{Number(deal.mrr) > 0 ? formatMoney(Number(deal.mrr)) : '—'}</td>
                    <td className="px-4 py-4 text-sm font-medium text-white">{deal.units}</td>
                    <td className="px-4 py-4">
                      {Number(deal.equipment_sell_price) > 0 ? (
                        <div className="text-xs leading-relaxed">
                          <p className="text-blue-400">Продажа: <span className="text-white font-medium">{formatMoney(Number(deal.equipment_sell_price))}</span></p>
                          <p className="text-blue-400">Закупка: <span className="text-white font-medium">{formatMoney(Number(deal.equipment_buy_price))}</span></p>
                          <p className="text-blue-400">Маржа: <span className={cn('font-semibold', Number(deal.equipment_margin) > 0 ? 'text-green-600' : Number(deal.equipment_margin) < 0 ? 'text-red-600' : 'text-white')}>{formatMoney(Number(deal.equipment_margin))}</span></p>
                        </div>
                      ) : <span className="text-sm text-blue-400">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {STATUS_OPTIONS.map((opt) => (
                          <button key={opt.value}
                            onClick={(e) => deal.status !== opt.value && handleStatusChange(deal.id, opt.value, e)}
                            className={cn(
                              'rounded-full px-3 py-1 text-xs font-semibold transition-all text-left whitespace-nowrap',
                              deal.status === opt.value
                                ? getDealStatusColor(opt.value)
                                : 'text-blue-400/60 hover:text-blue-400 hover:bg-white/5'
                            )}>
                            {opt.label}
                            {opt.value === 'paid' && deal.status === 'paid' && deal.paid_at && (
                              <span className="ml-1 text-xs font-normal text-green-500">
                                {formatDate(deal.paid_at)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-blue-400">{formatDate(deal.created_at)}</td>
                    <td className="px-4 py-4">
                      {user?.role === 'manager' && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(deal)}
                            className="rounded-lg p-2 text-blue-400 hover:bg-white/5 transition-colors"
                            title="Редактировать">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDelete(deal.id)}
                            className="rounded-lg p-2 text-red-400 hover:bg-red-50/10 transition-colors"
                            title="Удалить">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-blue-400">Нет сделок</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add button — only for managers viewing own data */}
          {!showForm && user?.role === 'manager' && !isViewingAs && (
            <button onClick={openNew}
              className="flex items-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600">
              <Plus size={20} />
              Новая сделка
            </button>
          )}
        </div>

        {/* Payment date popup */}
        {paidPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/20" onClick={() => setPaidPopup(null)} />
            <div className="relative rounded-2xl glass p-6 shadow-xl w-80">
              <h3 className="text-base font-bold text-white mb-1">Дата оплаты</h3>
              <p className="text-xs text-blue-400 mb-4">Укажите дату поступления оплаты</p>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setPaidPopup(null)}
                  className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-white/5 transition-colors">
                  Отмена
                </button>
                <button onClick={confirmPaid}
                  className="flex-1 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                  <Check size={16} />
                  Оплачено
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </MobileRestricted>
  )
}
