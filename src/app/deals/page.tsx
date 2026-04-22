'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Loader2, X, Pencil, Trash2, Check, Calendar, Eye } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ViewAsBar from '@/components/ViewAsBar'
import CustomSelect from '@/components/CustomSelect'
import DealIcon from '@/components/DealIcon'
import { formatMoney, getDealStatusLabel, getDealStatusColor, getProductTypeLabel, getSubscriptionPeriodLabel, cn, calcMrr, isBondaCompany } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { useViewAs } from '@/lib/view-as-context'
import { getCurrentUser, getActivePeriod, getDeals, createDeal, updateDeal, recordPartialPayment } from '@/lib/supabase/queries'
import type { Deal, Period, User } from '@/types/database'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/Toast'

const STATUS_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'no_invoice', label: 'Нет счёта' },
  { key: 'waiting_payment', label: 'Жду оплату' },
  { key: 'partial', label: 'Частично' },
  { key: 'paid', label: 'Оплачено' },
]

const STATUS_OPTIONS = [
  { value: 'no_invoice', label: 'Нет счёта' },
  { value: 'waiting_payment', label: 'Жду оплату' },
  { value: 'partial', label: 'Частично оплачено' },
  { value: 'paid', label: 'Оплачено' },
]

const PRODUCT_TYPE_OPTIONS_BONDA = [
  { value: 'findir', label: 'ФинДир (ФД)' },
  { value: 'bonda_bi', label: 'Bonda BI' },
  { value: 'one_time_service', label: 'Разовая услуга' },
]

const PRODUCT_TYPE_OPTIONS_INNO = [
  { value: 'inno_license', label: 'Лицензия inno clouds' },
  { value: 'inno_implementation', label: 'Услуги внедрения' },
  { value: 'inno_content', label: 'Генерация контента' },
]

const SUBSCRIPTION_PERIOD_OPTIONS = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'half_year', label: 'Полгода' },
  { value: 'year', label: 'Год' },
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
  product_type: 'findir',
  subscription_period: 'month',
  amo_link: '',
  impl_revenue: '',
  content_revenue: '',
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
  const { toast } = useToast()
  const { viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs } = useViewAs()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [period, setPeriod] = useState<Period | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Detect БОНДА company (учитываем viewAs) — через company_type, fallback на имя внутри хелпера
  const viewCompany = isViewingAs ? viewAsUser?.company : user?.company
  const isBonda = isBondaCompany(viewCompany)

  // Payment date popup state
  const [paidPopup, setPaidPopup] = useState<{ dealId: string; rect: DOMRect } | null>(null)
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))

  // Partial payment popup state
  const [partialPopup, setPartialPopup] = useState<{ deal: Deal } | null>(null)
  const [partialForm, setPartialForm] = useState({ license: '', impl: '', content: '', equipment: '', amount: '', paid_at: new Date().toISOString().slice(0, 10) })

  // Load current user once
  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
      } catch (err) {
        logger.error('Deals load error', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Load deals — re-runs when viewAsUser changes
  useEffect(() => {
    if (!user || !user.company_id) return
    const targetUserId = effectiveUserId(user.id)
    const targetCompanyId = effectiveCompanyId(user.company_id)

    // Admin/director/rop/founder without viewAs — show empty
    if (['admin', 'director', 'rop', 'founder'].includes(user.role) && !isViewingAs) {
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
        logger.error('Deals load error', err)
        toast('Не удалось загрузить сделки. Проверь соединение и обнови страницу.', 'error')
      }
    }
    loadDeals()
  }, [supabase, user, viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs, selectedStatus])

  function validateForm(): string | null {
    const name = form.client_name.trim()
    if (!name) return 'Укажи клиента'
    if (name.length > 200) return 'Название клиента слишком длинное (макс. 200 символов)'

    const revenue = Number(form.revenue) || 0
    if (revenue < 0) return 'Сумма не может быть отрицательной'
    if (revenue > 1_000_000_000) return 'Сумма выглядит подозрительно большой — проверь'

    if (!isBonda) {
      const units = Number(form.units) || 0
      if (units < 0) return 'Количество лицензий не может быть отрицательным'
      if (units > 10_000) return 'Количество лицензий подозрительно большое — проверь'

      const mrr = Number(form.mrr) || 0
      if (mrr < 0) return 'MRR не может быть отрицательным'

      const sell = Number(form.equipment_sell_price) || 0
      const buy = Number(form.equipment_buy_price) || 0
      if (sell < 0 || buy < 0) return 'Цены оборудования не могут быть отрицательными'

      const impl = Number(form.impl_revenue) || 0
      const content = Number(form.content_revenue) || 0
      if (impl < 0 || content < 0) return 'Выручка по внедрению/контенту не может быть отрицательной'
    }

    if (form.amo_link && form.amo_link.trim() && !/^https?:\/\//i.test(form.amo_link.trim())) {
      return 'Ссылка AMO должна начинаться с http:// или https://'
    }

    return null
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !period) {
      setError('Данные пользователя ещё не загружены')
      return
    }
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      const margin = calcMargin(form.equipment_sell_price, form.equipment_buy_price)
      const dealData: Record<string, any> = {
        client_name: form.client_name.trim(),
        revenue: Number(form.revenue) || 0,
        status: form.status,
        planned_payment_date: form.planned_payment_date || null,
        notes: form.notes || '',
      }

      if (isBonda) {
        dealData.product_type = form.product_type
        dealData.subscription_period = form.product_type === 'one_time_service' ? null : form.subscription_period
        dealData.amo_link = form.amo_link || null
        dealData.units = 1
        dealData.mrr = calcMrr(
          Number(form.revenue) || 0,
          form.product_type === 'one_time_service' ? null : form.subscription_period,
          form.product_type
        )
        dealData.equipment_margin = 0
      } else {
        dealData.product_type = 'inno_license'
        dealData.subscription_period = form.subscription_period
        // MRR: если менеджер ввёл вручную — используем, иначе считаем автоматом
        const manualMrr = Number(form.mrr) || 0
        const autoMrr = calcMrr(Number(form.revenue) || 0, form.subscription_period)
        dealData.mrr = manualMrr > 0 ? manualMrr : autoMrr
        dealData.units = Number(form.units) || 1
        dealData.equipment_sell_price = Number(form.equipment_sell_price) || 0
        dealData.equipment_buy_price = Number(form.equipment_buy_price) || 0
        dealData.equipment_margin = margin
        dealData.impl_revenue = Number(form.impl_revenue) || 0
        dealData.content_revenue = Number(form.content_revenue) || 0
      }

      if (editingDeal) {
        await updateDeal(supabase, editingDeal.id, dealData)
      } else {
        await createDeal(supabase, {
          ...dealData,
          client_name: form.client_name,
          user_id: user.id,
          period_id: period.id,
        } as any)
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
    if (!user || !period) return
    if (!confirm('Удалить сделку?')) return
    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId)
      if (error) throw error
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
      setDeals(dealsData)
    } catch (err: any) {
      toast(err.message || 'Ошибка удаления', 'error')
    }
  }

  async function handleStatusChange(dealId: string, newStatus: string, e?: React.MouseEvent, deal?: Deal) {
    if (newStatus === 'paid') {
      // Show date popup
      const rect = (e?.currentTarget as HTMLElement)?.getBoundingClientRect()
      setPaidPopup({ dealId, rect: rect || new DOMRect() })
      setPaidDate(new Date().toISOString().slice(0, 10))
      return
    }
    if (newStatus === 'partial' && deal) {
      // Open partial payment popup to enter amounts
      openPartialPayment(deal)
      return
    }
    if (!user || !period) return
    try {
      await updateDeal(supabase, dealId, { status: newStatus, paid_at: null })
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
      setDeals(dealsData)
    } catch (err: any) {
      toast(err.message || 'Ошибка смены статуса', 'error')
    }
  }

  async function confirmPaid() {
    if (!paidPopup || !user || !period) return
    try {
      await updateDeal(supabase, paidPopup.dealId, { status: 'paid', paid_at: paidDate })
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
      setDeals(dealsData)
      setPaidPopup(null)
    } catch (err: any) {
      toast(err.message || 'Ошибка', 'error')
    }
  }

  async function openPartialPayment(deal: Deal) {
    setPartialPopup({ deal })
    setPartialForm({
      license: String(Number(deal.paid_license || 0)),
      impl: String(Number(deal.paid_impl || 0)),
      content: String(Number(deal.paid_content || 0)),
      equipment: String(Number(deal.paid_equipment || 0)),
      amount: String(Number(deal.paid_amount || 0)),
      paid_at: deal.paid_at || new Date().toISOString().slice(0, 10),
    })
  }

  async function confirmPartialPayment() {
    if (!partialPopup || !user || !period) return
    const deal = partialPopup.deal
    try {
      // Передаём сырые суммы — серверный RPC (record_partial_payment) сам:
      //   1. Лочит строку (SELECT FOR UPDATE) — защита от гонок,
      //   2. Clamp'ит значения по revenue/impl_revenue/..,
      //   3. Считает итоговый status по единой логике ИННО/БОНДА.
      await recordPartialPayment(supabase, {
        dealId: deal.id,
        paid_license: isBonda ? null : (Number(partialForm.license) || 0),
        paid_impl: isBonda ? null : (Number(partialForm.impl) || 0),
        paid_content: isBonda ? null : (Number(partialForm.content) || 0),
        paid_equipment: isBonda ? null : (Number(partialForm.equipment) || 0),
        paid_amount: isBonda ? (Number(partialForm.amount) || 0) : null,
        paid_at: partialForm.paid_at || null,
      })
      const targetUserId = effectiveUserId(user.id)
      const dealsData = await getDeals(supabase, targetUserId, period.id, selectedStatus)
      setDeals(dealsData)
      setPartialPopup(null)
    } catch (err: any) {
      toast(err.message || 'Ошибка записи оплаты', 'error')
    }
  }

  function openEdit(deal: Deal) {
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
      product_type: deal.product_type || (isBonda ? 'findir' : 'inno_license'),
      subscription_period: deal.subscription_period || 'month',
      amo_link: deal.amo_link || '',
      impl_revenue: String(Number(deal.impl_revenue || 0)),
      content_revenue: String(Number(deal.content_revenue || 0)),
    })
    setShowForm(true)
    setError('')
  }

  function openNew() {
    setEditingDeal(null)
    setForm({ ...EMPTY_FORM, product_type: isBonda ? 'findir' : 'inno_license' })
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
  const totalRevenue = filteredDeals.reduce((sum, deal) => sum + Number(deal.revenue) + Number(deal.impl_revenue || 0) + Number(deal.content_revenue || 0), 0)
  const totalUnits = filteredDeals.reduce((sum, deal) => Number(deal.revenue) > 0 ? sum + deal.units : sum, 0)
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
          {isBonda ? (
            <div className="mb-8 grid grid-cols-4 gap-4">
              <div className="rounded-2xl glass p-6">
                <p className="text-sm font-medium text-blue-400">Сумма контрактов</p>
                <p className="font-heading text-2xl font-bold text-white mt-2">{formatMoney(totalRevenue)}</p>
              </div>
              <div className="rounded-2xl glass p-6">
                <p className="text-sm font-medium text-purple-400">ФинДиров (оплач.)</p>
                <p className="font-heading text-2xl font-bold text-white mt-2">{filteredDeals.filter(d => d.product_type === 'findir' && ['paid', 'partial'].includes(d.status)).length}</p>
              </div>
              <div className="rounded-2xl glass p-6">
                <p className="text-sm font-medium text-cyan-400">Bonda BI (оплач.)</p>
                <p className="font-heading text-2xl font-bold text-white mt-2">{filteredDeals.filter(d => d.product_type === 'bonda_bi' && ['paid', 'partial'].includes(d.status)).length}</p>
              </div>
              <div className="rounded-2xl glass p-6">
                <p className="text-sm font-medium text-orange-400">Разовых (оплач.)</p>
                <p className="font-heading text-2xl font-bold text-white mt-2">{filteredDeals.filter(d => d.product_type === 'one_time_service' && ['paid', 'partial'].includes(d.status)).length}</p>
              </div>
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-4 gap-4">
              <div className="rounded-2xl glass p-6">
                <p className="text-sm font-medium text-blue-400">Выручка</p>
                <p className="font-heading text-2xl font-bold text-white mt-2">{formatMoney(totalRevenue)}</p>
              </div>
              <div className="rounded-2xl glass p-6">
                <p className="text-sm font-medium text-blue-400">Лицензии</p>
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
          )}

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
          {user && ['admin', 'director', 'rop', 'founder'].includes(user.role) && !isViewingAs && (
            <div className="glass rounded-2xl p-12 text-center">
              <Eye className="w-12 h-12 text-white/15 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-white mb-2">Выберите менеджера</h2>
              <p className="text-sm text-white/40">Нажмите «Выбрать менеджера» чтобы просмотреть его сделки</p>
            </div>
          )}

          {/* Add button — only for managers viewing own data */}
          {user?.role === 'manager' && !isViewingAs && (
            <button onClick={openNew}
              className="mb-6 flex items-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600">
              <Plus size={20} />
              Новая сделка
            </button>
          )}

          {/* Deals Table */}
          <div className="mb-8 overflow-x-auto rounded-2xl glass">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Клиент</th>
                  {isBonda ? (
                    <>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-white">Продукт</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-white">Сумма</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-white">Период</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-white">Лицензия</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-white">Внедрение</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-white">Контент</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-white">Оборудование</th>
                    </>
                  )}
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
                        <DealIcon deal={deal} isBonda={isBonda} size={40} />
                        <div>
                          <span className="text-sm font-medium text-white">{deal.client_name}</span>
                          {deal.notes && <p className="text-xs text-blue-400 mt-0.5">{deal.notes}</p>}
                          {isBonda && deal.amo_link && (
                            <a href={deal.amo_link} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 mt-0.5 block">AMO →</a>
                          )}
                        </div>
                      </div>
                    </td>
                    {isBonda ? (
                      <>
                        <td className="px-4 py-4">
                          <span className={cn(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            deal.product_type === 'findir' ? 'bg-purple-500/20 text-purple-400' :
                            deal.product_type === 'bonda_bi' ? 'bg-cyan-500/20 text-cyan-400' :
                            'bg-orange-500/20 text-orange-400'
                          )}>
                            {getProductTypeLabel(deal.product_type || '')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-white">
                          {Number(deal.revenue) > 0 ? formatMoney(Number(deal.revenue)) : '—'}
                        </td>
                        <td className="px-4 py-4 text-sm text-blue-400">
                          {deal.subscription_period ? getSubscriptionPeriodLabel(deal.subscription_period) : '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4">
                          {Number(deal.revenue) > 0 ? (
                            <div className="text-xs leading-relaxed">
                              <p className="text-white/50">Выр: <span className="text-white font-medium">{formatMoney(Number(deal.revenue))}</span></p>
                              {Number(deal.mrr) > 0 && <p className="text-white/50">MRR: <span className="text-blue-400 font-medium">{formatMoney(Number(deal.mrr))}</span></p>}
                              <p className="text-white/50">Лиц.: <span className="text-white font-medium">{deal.units}</span></p>
                            </div>
                          ) : <span className="text-sm text-white/30">—</span>}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium">
                          {Number(deal.impl_revenue) > 0 ? <span className="text-green-400">{formatMoney(Number(deal.impl_revenue))}</span> : <span className="text-white/30">—</span>}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium">
                          {Number(deal.content_revenue) > 0 ? <span className="text-purple-400">{formatMoney(Number(deal.content_revenue))}</span> : <span className="text-white/30">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          {Number(deal.equipment_sell_price) > 0 ? (
                            <div className="text-xs leading-relaxed">
                              <p className="text-white/50">Прод: <span className="text-white font-medium">{formatMoney(Number(deal.equipment_sell_price))}</span></p>
                              <p className="text-white/50">Закуп: <span className="text-white font-medium">{formatMoney(Number(deal.equipment_buy_price))}</span></p>
                              <p className="text-white/50">Маржа: <span className={cn('font-semibold', Number(deal.equipment_margin) > 0 ? 'text-green-400' : Number(deal.equipment_margin) < 0 ? 'text-red-400' : 'text-white/30')}>{formatMoney(Number(deal.equipment_margin))}</span></p>
                            </div>
                          ) : <span className="text-sm text-white/30">—</span>}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {STATUS_OPTIONS.map((opt) => (
                          <button key={opt.value}
                            onClick={(e) => deal.status !== opt.value && handleStatusChange(deal.id, opt.value, e, deal)}
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
                      {user?.role === 'manager' && !isViewingAs && (
                        <div className="flex items-center justify-end gap-2">
                          {deal.status !== 'paid' && (
                            <button onClick={() => openPartialPayment(deal)}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-green-400 hover:bg-green-500/10 transition-colors whitespace-nowrap"
                              title="Записать оплату">
                              ₽
                            </button>
                          )}
                          <button onClick={() => openEdit(deal)}
                            className="rounded-lg p-2 text-blue-400 hover:bg-white/5 transition-colors"
                            title="Редактировать" aria-label="Редактировать сделку">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDelete(deal.id)}
                            className="rounded-lg p-2 text-red-400 hover:bg-red-50/10 transition-colors"
                            title="Удалить" aria-label="Удалить сделку">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isBonda ? 7 : 8} className="px-6 py-8 text-center text-sm text-blue-400">Нет сделок</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </main>

      {/* Payment date popup — вынесен из main для корректного fixed */}
      {paidPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPaidPopup(null)} />
          <div className="relative rounded-3xl glass-strong p-6 w-80">
            <h3 className="text-base font-bold text-white mb-1">Дата оплаты</h3>
            <p className="text-xs text-blue-400 mb-4">Укажите дату поступления оплаты</p>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-4 date-input-clean cursor-pointer"
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

      {/* Deal form modal — вынесен из main для корректного fixed */}
      {showForm && user?.role === 'manager' && !isViewingAs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowForm(false); setEditingDeal(null); setForm(EMPTY_FORM) }} />
          <div className="relative rounded-3xl glass-strong p-6 w-[600px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">
                {editingDeal ? 'Редактировать сделку' : 'Новая сделка'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingDeal(null); setForm(EMPTY_FORM) }}
                className="rounded-lg p-2 text-blue-400 hover:bg-white/5" aria-label="Закрыть форму">
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
                  <CustomSelect value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={STATUS_OPTIONS} />
                </div>
              </div>

              {isBonda ? (
                <>
                  {/* БОНДА: Тип продукта + Период подписки */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-1">Тип продукта *</label>
                      <CustomSelect value={form.product_type || (isBonda ? 'findir' : 'inno_license')} onChange={(v) => setForm({ ...form, product_type: v })} options={isBonda ? PRODUCT_TYPE_OPTIONS_BONDA : PRODUCT_TYPE_OPTIONS_INNO} />
                    </div>
                    {form.product_type !== 'one_time_service' && form.product_type !== 'inno_implementation' && (
                      <div>
                        <label className="block text-sm font-medium text-white mb-1">Период подписки</label>
                        <CustomSelect value={form.subscription_period} onChange={(v) => setForm({ ...form, subscription_period: v })} options={SUBSCRIPTION_PERIOD_OPTIONS} />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-white mb-1">Сумма контракта</label>
                      <input type="number" value={form.revenue}
                        onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                        placeholder="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-1">Ссылка AMO CRM</label>
                      <input type="text" value={form.amo_link}
                        onChange={(e) => setForm({ ...form, amo_link: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                        placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-1">Планируемая дата оплаты</label>
                      <input type="date" value={form.planned_payment_date}
                        onChange={(e) => setForm({ ...form, planned_payment_date: e.target.value })}
                        onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none date-input-clean cursor-pointer" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* ИННО: Лицензия */}
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-blue-400 mb-3">Лицензия inno clouds</p>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Выручка</label>
                        <input type="number" value={form.revenue}
                          onChange={(e) => setForm({ ...form, revenue: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">MRR</label>
                        <input type="number" value={form.mrr}
                          onChange={(e) => setForm({ ...form, mrr: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder={String(calcMrr(Number(form.revenue) || 0, form.subscription_period))} />
                        {Number(form.revenue) > 0 && !form.mrr && (
                          <p className="text-[10px] text-blue-400/50 mt-1 truncate">авто: {formatMoney(calcMrr(Number(form.revenue), form.subscription_period))}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Лицензии</label>
                        <input type="number" value={form.units}
                          onChange={(e) => setForm({ ...form, units: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Период подписки</label>
                        <CustomSelect value={form.subscription_period} onChange={(v) => setForm({ ...form, subscription_period: v })} options={SUBSCRIPTION_PERIOD_OPTIONS} />
                      </div>
                    </div>
                  </div>

                  {/* ИННО: Внедрение + Генерация */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-green-400 mb-3">Услуги внедрения</p>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Выручка</label>
                        <input type="number" value={form.impl_revenue}
                          onChange={(e) => setForm({ ...form, impl_revenue: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="0" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-purple-400 mb-3">Генерация контента</p>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Выручка</label>
                        <input type="number" value={form.content_revenue}
                          onChange={(e) => setForm({ ...form, content_revenue: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="0" />
                      </div>
                    </div>
                  </div>

                  {/* Equipment block */}
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-yellow-400 mb-3">Оборудование</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Цена продажи</label>
                        <input type="number" value={form.equipment_sell_price}
                          onChange={(e) => setForm({ ...form, equipment_sell_price: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Цена закупки</label>
                        <input type="number" value={form.equipment_buy_price}
                          onChange={(e) => setForm({ ...form, equipment_buy_price: e.target.value })}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Маржа (авто)</label>
                        <div className={cn(
                          "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold",
                          calcMargin(form.equipment_sell_price, form.equipment_buy_price) > 0 ? 'text-green-400' :
                          calcMargin(form.equipment_sell_price, form.equipment_buy_price) < 0 ? 'text-red-400' : 'text-white/40'
                        )}>
                          {formatMoney(calcMargin(form.equipment_sell_price, form.equipment_buy_price))}
                        </div>
                        <p className="text-xs text-white/40 mt-1">продажа − 10% НДС − закупка</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-1">Планируемая дата оплаты</label>
                      <input type="date" value={form.planned_payment_date}
                        onChange={(e) => setForm({ ...form, planned_payment_date: e.target.value })}
                        onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none date-input-clean cursor-pointer" />
                    </div>
                  </div>
                </>
              )}

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
        </div>
      )}

      {/* Partial payment popup — вынесен из main для корректного fixed */}
      {partialPopup && (() => {
        const d = partialPopup.deal
        const pL = Number(partialForm.license) || 0, tL = Number(d.revenue || 0)
        const pI = Number(partialForm.impl) || 0, tI = Number(d.impl_revenue || 0)
        const pC = Number(partialForm.content) || 0, tC = Number(d.content_revenue || 0)
        const pE = Number(partialForm.equipment) || 0, tE = Number(d.equipment_sell_price || 0)
        const pA = Number(partialForm.amount) || 0, tA = Number(d.revenue || 0)
        const innoTotal = tL + tI + tC + tE
        const innoPaid = pL + pI + pC + pE
        const allPaidInno = innoTotal > 0 && pL >= tL && pI >= tI && pC >= tC && pE >= tE
        const allPaidBonda = tA > 0 && pA >= tA
        const progressPct = (paid: number, total: number) => total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
        const progressColor = (paid: number, total: number) => paid >= total ? 'bg-green-500' : 'bg-blue-500'

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPartialPopup(null)} />
          <div className="relative rounded-3xl glass-strong p-6 w-[480px] max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-1">Записать оплату</h3>
            <p className="text-xs text-white/40 mb-1">{d.client_name}</p>

            {/* Summary bar */}
            {!isBonda ? (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-white/40">Оплачено</span>
                <span className={cn('text-sm font-bold', allPaidInno ? 'text-green-400' : 'text-white')}>
                  {formatMoney(innoPaid)} <span className="text-white/30 font-normal">из {formatMoney(innoTotal)}</span>
                </span>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-white/40">Оплачено</span>
                <span className={cn('text-sm font-bold', allPaidBonda ? 'text-green-400' : 'text-white')}>
                  {formatMoney(pA)} <span className="text-white/30 font-normal">из {formatMoney(tA)}</span>
                </span>
              </div>
            )}

            {isBonda ? (
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-purple-400">Сумма контракта</label>
                    <span className="text-xs text-white/40">{formatMoney(tA)}</span>
                  </div>
                  <input type="number" min="0" max={tA} value={partialForm.amount}
                    onChange={(e) => { const v = Math.min(Number(e.target.value) || 0, tA); setPartialForm({ ...partialForm, amount: String(v) }) }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none"
                    placeholder="0" />
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', progressColor(pA, tA))} style={{ width: `${progressPct(pA, tA)}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-white/30">{progressPct(pA, tA)}%</span>
                    <span className={cn('text-xs', pA >= tA ? 'text-green-400' : 'text-white/40')}>
                      {pA >= tA ? '✓ Оплачено' : `Осталось ${formatMoney(tA - pA)}`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {tL > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-blue-400">Лицензия</label>
                      <span className="text-xs text-white/40">{formatMoney(tL)}</span>
                    </div>
                    <input type="number" min="0" max={tL} value={partialForm.license}
                      onChange={(e) => { const v = Math.min(Number(e.target.value) || 0, tL); setPartialForm({ ...partialForm, license: String(v) }) }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="0" />
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', progressColor(pL, tL))} style={{ width: `${progressPct(pL, tL)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-white/30">{progressPct(pL, tL)}%</span>
                      <span className={cn('text-xs', pL >= tL ? 'text-green-400' : 'text-white/40')}>
                        {pL >= tL ? '✓ Оплачено' : `Осталось ${formatMoney(tL - pL)}`}
                      </span>
                    </div>
                  </div>
                )}
                {tI > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-green-400">Внедрение</label>
                      <span className="text-xs text-white/40">{formatMoney(tI)}</span>
                    </div>
                    <input type="number" min="0" max={tI} value={partialForm.impl}
                      onChange={(e) => { const v = Math.min(Number(e.target.value) || 0, tI); setPartialForm({ ...partialForm, impl: String(v) }) }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-green-500 focus:outline-none"
                      placeholder="0" />
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', progressColor(pI, tI))} style={{ width: `${progressPct(pI, tI)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-white/30">{progressPct(pI, tI)}%</span>
                      <span className={cn('text-xs', pI >= tI ? 'text-green-400' : 'text-white/40')}>
                        {pI >= tI ? '✓ Оплачено' : `Осталось ${formatMoney(tI - pI)}`}
                      </span>
                    </div>
                  </div>
                )}
                {tC > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-purple-400">Контент</label>
                      <span className="text-xs text-white/40">{formatMoney(tC)}</span>
                    </div>
                    <input type="number" min="0" max={tC} value={partialForm.content}
                      onChange={(e) => { const v = Math.min(Number(e.target.value) || 0, tC); setPartialForm({ ...partialForm, content: String(v) }) }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none"
                      placeholder="0" />
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', progressColor(pC, tC))} style={{ width: `${progressPct(pC, tC)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-white/30">{progressPct(pC, tC)}%</span>
                      <span className={cn('text-xs', pC >= tC ? 'text-green-400' : 'text-white/40')}>
                        {pC >= tC ? '✓ Оплачено' : `Осталось ${formatMoney(tC - pC)}`}
                      </span>
                    </div>
                  </div>
                )}
                {tE > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-yellow-400">Оборудование</label>
                      <span className="text-xs text-white/40">{formatMoney(tE)}</span>
                    </div>
                    <input type="number" min="0" max={tE} value={partialForm.equipment}
                      onChange={(e) => { const v = Math.min(Number(e.target.value) || 0, tE); setPartialForm({ ...partialForm, equipment: String(v) }) }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-yellow-500 focus:outline-none"
                      placeholder="0" />
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', progressColor(pE, tE))} style={{ width: `${progressPct(pE, tE)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-white/30">{progressPct(pE, tE)}%</span>
                      <span className={cn('text-xs', pE >= tE ? 'text-green-400' : 'text-white/40')}>
                        {pE >= tE ? '✓ Оплачено' : `Осталось ${formatMoney(tE - pE)}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-1">Дата оплаты</label>
              <input type="date" value={partialForm.paid_at}
                onChange={(e) => setPartialForm({ ...partialForm, paid_at: e.target.value })}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none date-input-clean cursor-pointer" />
            </div>

            {/* Auto-status hint */}
            {!isBonda && allPaidInno && (
              <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-xs text-green-400">
                Все категории оплачены — статус автоматически сменится на «Оплачено»
              </div>
            )}
            {isBonda && allPaidBonda && (
              <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-xs text-green-400">
                Контракт полностью оплачен — статус автоматически сменится на «Оплачено»
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setPartialPopup(null)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
                Отмена
              </button>
              <button onClick={confirmPartialPayment}
                className="flex-1 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                <Check size={16} />
                Записать
              </button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
    </MobileRestricted>
  )
}
