'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Users, ChevronDown, ChevronUp, TrendingUp, AlertTriangle,
  Clock, CheckCircle2, Circle, BarChart3, Target
} from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ProgressBar from '@/components/ProgressBar'
import { formatMoney, cn, getDealStatusLabel, getDealStatusColor } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getTeamProgress, getKpiEntries, getKpiApprovals, toggleKpiApproval } from '@/lib/supabase/queries'

type CompanyFilter = 'all' | string
type TabView = 'fact' | 'forecast'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Оплачено', cls: 'text-emerald-400' },
  waiting_payment: { label: 'Ждёт оплаты', cls: 'text-amber-400' },
  no_invoice: { label: 'Без счёта', cls: 'text-white/40' },
  cancelled: { label: 'Отменена', cls: 'text-red-400' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function ForecastDualBar({ label, fact, forecast, plan, formatValue }: {
  label: string; fact: number; forecast: number; plan: number; formatValue?: (v: number) => string
}) {
  const fmt = formatValue || ((v: number) => String(v))
  const total = fact + forecast
  const totalPct = plan > 0 ? Math.round(total / plan * 100) : 0
  const factPct = plan > 0 ? Math.min(Math.round(fact / plan * 100), 100) : 0
  const forecastPct = plan > 0 ? Math.min(Math.round(forecast / plan * 100), 100 - factPct) : 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-white/50">{label}</span>
        <span className="font-medium text-white">
          {fmt(fact)} оплач. + {fmt(forecast)} прогноз
          {plan > 0 && (
            <span className={cn(
              'ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
              totalPct >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
            )}>
              {totalPct}%
            </span>
          )}
        </span>
      </div>
      {plan > 0 && (
        <div className="h-3 bg-white/10 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 absolute left-0 top-0"
            style={{ width: `${factPct}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-blue-400/50 to-blue-500/50 absolute top-0"
            style={{ left: `${factPct}%`, width: `${forecastPct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function TeamPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [periods, setPeriods] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<TabView>('fact')

  // KPI data for managers (loaded on expand)
  const [kpiData, setKpiData] = useState<Record<string, { entries: any[]; approvals: any[] }>>({})
  const [kpiLoading, setKpiLoading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        if (!['rop', 'director', 'admin', 'founder'].includes(currentUser.role)) {
          router.push('/dashboard')
          return
        }

        const { data: allPeriods } = await supabase
          .from('periods')
          .select('id, company_id')
          .eq('status', 'active')

        const periodMap: Record<string, string> = {}
        for (const p of (allPeriods || [])) {
          periodMap[p.company_id] = p.id
        }
        setPeriods(periodMap)

        const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
        const teamData = await getTeamProgress(supabase, currentUser.company_id, activePeriod?.id || '')
        setTeam(teamData)
      } catch (err) {
        console.error('Team load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  function getPeriodForUser(companyId: string): string | null {
    return periods[companyId] || null
  }

  async function loadKpiForUser(userId: string, companyId: string) {
    const pid = getPeriodForUser(companyId)
    if (!pid || kpiData[userId]) return
    setKpiLoading(userId)
    try {
      const [entries, approvals] = await Promise.all([
        getKpiEntries(supabase, userId, pid),
        getKpiApprovals(supabase, userId, pid),
      ])
      setKpiData(prev => ({ ...prev, [userId]: { entries, approvals } }))
    } catch (err) {
      console.error('KPI load error:', err)
    } finally {
      setKpiLoading(null)
    }
  }

  async function handleToggleApproval(managerId: string, kpiType: string, companyId: string) {
    const pid = getPeriodForUser(companyId)
    if (!pid || !user) return
    try {
      await toggleKpiApproval(supabase, managerId, pid, kpiType, user.id)
      const approvals = await getKpiApprovals(supabase, managerId, pid)
      setKpiData(prev => ({
        ...prev,
        [managerId]: { ...prev[managerId], approvals },
      }))
    } catch (err: any) {
      alert(err.message || 'Ошибка')
    }
  }

  function handleExpand(userId: string, companyId: string) {
    const isExpanding = expandedId !== userId
    setExpandedId(isExpanding ? userId : null)
    if (isExpanding) {
      loadKpiForUser(userId, companyId)
    }
  }

  const companies = useMemo(() => {
    const map = new Map<string, string>()
    team.forEach(m => { if (m.company_id && m.company_name) map.set(m.company_id, m.company_name) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [team])

  const filtered = useMemo(() => {
    if (companyFilter === 'all') return team
    return team.filter(m => m.company_id === companyFilter)
  }, [team, companyFilter])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  // === Helper: is БОНДА company ===
  const isBondaManager = (m: any) => m.company_name?.toUpperCase()?.includes('БОНД') || false
  const isInnoManager = (m: any) => !isBondaManager(m)

  // === ФАКТ aggregates ===
  const totalRevFact = filtered.reduce((s, m) => s + m.revenue_fact, 0)
  const totalPlan = filtered.reduce((s, m) => s + m.revenue_plan, 0)
  const avgRevPct = totalPlan > 0 ? Math.round((totalRevFact / totalPlan) * 100) : 0
  const totalUnitsFact = filtered.reduce((s, m) => s + m.units_fact, 0)
  const totalUnitsP = filtered.reduce((s, m) => s + m.units_plan, 0)
  const totalMeetFact = filtered.reduce((s, m) => s + m.meetings_fact, 0)
  const totalMeetP = filtered.reduce((s, m) => s + m.meetings_plan, 0)
  const totalDealsPaid = filtered.reduce((s, m) => s + m.deals_paid, 0)
  const totalMarginFact = filtered.reduce((s, m) => s + m.margin_fact, 0)

  // === Cross-company aggregates for "Все" filter ===
  const innoManagers = team.filter(isInnoManager)
  const bondaManagers = team.filter(isBondaManager)

  const totalUnitsFactInno = innoManagers.reduce((s, m) => s + m.units_fact, 0)
  const totalUnitsPlanInno = innoManagers.reduce((s, m) => s + m.units_plan, 0)
  const totalFdCountBonda = bondaManagers.reduce((s, m) => s + m.fd_count, 0)
  const totalFdPlanBonda = bondaManagers.reduce((s, m) => s + m.findir_plan, 0)
  const totalBiCountBonda = bondaManagers.reduce((s, m) => s + m.bi_count, 0)
  const totalOtCountBonda = bondaManagers.reduce((s, m) => s + m.ot_count, 0)

  // Company-specific for filtered view
  const totalFdCount = filtered.reduce((s, m) => s + m.fd_count, 0)
  const totalFdPlan = filtered.reduce((s, m) => s + m.findir_plan, 0)
  const totalBiCount = filtered.reduce((s, m) => s + m.bi_count, 0)
  const totalOtCount = filtered.reduce((s, m) => s + m.ot_count, 0)

  // Determine current filter type
  const isFilterAll = companyFilter === 'all'
  const isFilterBonda = !isFilterAll && filtered.length > 0 && isBondaManager(filtered[0])
  const isFilterInno = !isFilterAll && !isFilterBonda

  // === ПРОГНОЗ aggregates ===
  const totalRevForecast = filtered.reduce((s, m) => s + m.revenue_forecast, 0)
  const totalRevWaiting = filtered.reduce((s, m) => s + m.revenue_waiting, 0)
  const totalRevNoInvoice = filtered.reduce((s, m) => s + m.revenue_no_invoice, 0)
  const totalDealsWaiting = filtered.reduce((s, m) => s + m.deals_waiting, 0)
  const totalDealsNoInvoice = filtered.reduce((s, m) => s + m.deals_no_invoice, 0)
  const totalRevTotal = totalRevFact + totalRevForecast
  const paidPercent = totalRevTotal > 0 ? Math.round((totalRevFact / totalRevTotal) * 100) : 0
  const totalForecastDeals = filtered.reduce((s, m) => s + (m.forecast_deals?.length || 0), 0)
  const totalUnitsWaiting = filtered.reduce((s, m) => s + m.units_waiting, 0)

  // === ПРОГНОЗ: forecast units & findirs ===
  // Forecast units from ИННО managers (unpaid deals)
  const forecastUnitsInno = (isFilterAll ? innoManagers : filtered.filter(isInnoManager))
    .reduce((s, m) => s + (m.forecast_deals || []).reduce((u: number, d: any) => u + (d.units || 0), 0), 0)
  const factUnitsInno = isFilterAll ? totalUnitsFactInno : filtered.filter(isInnoManager).reduce((s, m) => s + m.units_fact, 0)
  const planUnitsInno = isFilterAll ? totalUnitsPlanInno : filtered.filter(isInnoManager).reduce((s, m) => s + m.units_plan, 0)

  // Forecast findirs from БОНДА managers (unpaid findir deals)
  const forecastFdBonda = (isFilterAll ? bondaManagers : filtered.filter(isBondaManager))
    .reduce((s, m) => s + (m.forecast_deals || []).filter((d: any) => d.product_type === 'findir').length, 0)
  const factFdBonda = isFilterAll ? totalFdCountBonda : filtered.filter(isBondaManager).reduce((s, m) => s + m.fd_count, 0)
  const planFdBonda = isFilterAll ? totalFdPlanBonda : totalFdPlan

  // For filtered single-company views
  const forecastUnitsFiltered = filtered.reduce((s, m) => s + (m.forecast_deals || []).reduce((u: number, d: any) => u + (d.units || 0), 0), 0)
  const forecastFdFiltered = filtered.reduce((s, m) => s + (m.forecast_deals || []).filter((d: any) => d.product_type === 'findir').length, 0)

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={user?.role || 'rop'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <h1 className="text-2xl font-heading font-bold text-white">Команда</h1>
            </div>
          </div>

          {/* Факт / Прогноз tabs */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setActiveTab('fact')}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                activeTab === 'fact'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Факт
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                activeTab === 'forecast'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
              )}
            >
              <Target className="w-4 h-4" />
              Прогноз
            </button>
          </div>

          {/* Company filter tabs */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setCompanyFilter('all')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                companyFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-white/10 text-blue-400 border border-white/10 hover:bg-white/15'
              )}
            >
              Все ({team.length})
            </button>
            {companies.map(c => {
              const count = team.filter(m => m.company_id === c.id).length
              return (
                <button
                  key={c.id}
                  onClick={() => setCompanyFilter(c.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    companyFilter === c.id ? 'bg-blue-500 text-white' : 'bg-white/10 text-blue-400 border border-white/10 hover:bg-white/15'
                  )}
                >
                  {c.name} ({count})
                </button>
              )
            })}
          </div>

          {/* =================== ФАКТ TAB =================== */}
          {activeTab === 'fact' && (
            <>
              {/* Summary cards — Факт (context-sensitive by company filter) */}
              {isFilterAll && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Общая выручка</p>
                    <p className="text-xl font-bold text-emerald-400">{formatMoney(totalRevFact)}</p>
                    {totalPlan > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {formatMoney(totalPlan)} ({avgRevPct}%)</p>}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Лицензии ИННО</p>
                    <p className="text-xl font-bold text-white">{totalUnitsFactInno} <span className="text-sm font-normal text-white/40">шт.</span></p>
                    {totalUnitsPlanInno > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalUnitsPlanInno} ({Math.round(totalUnitsFactInno / totalUnitsPlanInno * 100)}%)</p>}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">ФинДиры БОНДА</p>
                    <p className="text-xl font-bold text-white">{totalFdCountBonda} <span className="text-sm font-normal text-white/40">шт.</span></p>
                    {totalFdPlanBonda > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalFdPlanBonda} ({Math.round(totalFdCountBonda / totalFdPlanBonda * 100)}%)</p>}
                    {(totalBiCountBonda > 0 || totalOtCountBonda > 0) && (
                      <p className="text-[10px] text-white/30 mt-0.5">BI: {totalBiCountBonda} · Разовые: {totalOtCountBonda}</p>
                    )}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Встречи</p>
                    <p className="text-xl font-bold text-white">{totalMeetFact}</p>
                    {totalMeetP > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalMeetP} ({Math.round(totalMeetFact / totalMeetP * 100)}%)</p>}
                  </div>
                </div>
              )}

              {isFilterInno && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Выручка ИННО</p>
                    <p className="text-xl font-bold text-emerald-400">{formatMoney(totalRevFact)}</p>
                    {totalPlan > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {formatMoney(totalPlan)} ({avgRevPct}%)</p>}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Лицензии</p>
                    <p className="text-xl font-bold text-white">{totalUnitsFact} <span className="text-sm font-normal text-white/40">шт.</span></p>
                    {totalUnitsP > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalUnitsP} ({Math.round(totalUnitsFact / totalUnitsP * 100)}%)</p>}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Встречи</p>
                    <p className="text-xl font-bold text-white">{totalMeetFact}</p>
                    {totalMeetP > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalMeetP} ({Math.round(totalMeetFact / totalMeetP * 100)}%)</p>}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Маржа (оборуд.)</p>
                    <p className="text-xl font-bold text-white">{formatMoney(totalMarginFact)}</p>
                  </div>
                </div>
              )}

              {isFilterBonda && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Выручка БОНДА</p>
                    <p className="text-xl font-bold text-emerald-400">{formatMoney(totalRevFact)}</p>
                    {totalPlan > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {formatMoney(totalPlan)} ({avgRevPct}%)</p>}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">ФинДиры</p>
                    <p className="text-xl font-bold text-white">{totalFdCount} <span className="text-sm font-normal text-white/40">шт.</span></p>
                    {totalFdPlan > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalFdPlan} ({Math.round(totalFdCount / totalFdPlan * 100)}%)</p>}
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Bonda BI / Разовые</p>
                    <p className="text-xl font-bold text-white">{totalBiCount} <span className="text-sm font-normal text-white/40">/ {totalOtCount}</span></p>
                  </div>
                  <div className="rounded-xl glass p-4">
                    <p className="text-xs text-white/40 mb-1">Встречи</p>
                    <p className="text-xl font-bold text-white">{totalMeetFact}</p>
                    {totalMeetP > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalMeetP} ({Math.round(totalMeetFact / totalMeetP * 100)}%)</p>}
                  </div>
                </div>
              )}

              {/* Overall progress (context-sensitive) */}
              <div className="glass rounded-xl p-5 mb-6">
                <h2 className="text-sm font-semibold text-white mb-3">Общий прогресс</h2>
                <div className="space-y-3">
                  <ProgressBar label="Выручка" value={totalRevFact} max={totalPlan} percent={avgRevPct} formatValue={formatMoney} />
                  {(isFilterAll || isFilterInno) && (
                    <ProgressBar
                      label={isFilterAll ? 'Лицензии ИННО' : 'Лицензии'}
                      value={isFilterAll ? totalUnitsFactInno : totalUnitsFact}
                      max={isFilterAll ? totalUnitsPlanInno : totalUnitsP}
                      percent={
                        (isFilterAll ? totalUnitsPlanInno : totalUnitsP) > 0
                          ? Math.round((isFilterAll ? totalUnitsFactInno : totalUnitsFact) / (isFilterAll ? totalUnitsPlanInno : totalUnitsP) * 100)
                          : 0
                      }
                    />
                  )}
                  {(isFilterAll || isFilterBonda) && (
                    <ProgressBar
                      label={isFilterAll ? 'ФинДиры БОНДА' : 'ФинДиры'}
                      value={isFilterAll ? totalFdCountBonda : totalFdCount}
                      max={isFilterAll ? totalFdPlanBonda : totalFdPlan}
                      percent={
                        (isFilterAll ? totalFdPlanBonda : totalFdPlan) > 0
                          ? Math.round((isFilterAll ? totalFdCountBonda : totalFdCount) / (isFilterAll ? totalFdPlanBonda : totalFdPlan) * 100)
                          : 0
                      }
                    />
                  )}
                  <ProgressBar label="Встречи" value={totalMeetFact} max={totalMeetP} percent={totalMeetP > 0 ? Math.round(totalMeetFact / totalMeetP * 100) : 0} />
                </div>
              </div>

              {/* Individual cards — Факт */}
              <div className="space-y-4">
                {filtered.map(m => {
                  const revPct = m.revenue_plan > 0 ? Math.round((m.revenue_fact / m.revenue_plan) * 100) : 0
                  const unitsPct = m.units_plan > 0 ? Math.round((m.units_fact / m.units_plan) * 100) : 0
                  const fdPct = m.findir_plan > 0 ? Math.round((m.fd_count / m.findir_plan) * 100) : 0
                  const meetPct = m.meetings_plan > 0 ? Math.round((m.meetings_fact / m.meetings_plan) * 100) : 0
                  const isExpanded = expandedId === m.id
                  const isBondaCompany = m.company_name?.toUpperCase()?.includes('БОНД') || false
                  const isJunior = m.position?.toLowerCase()?.includes('младш') || false

                  const statusIcon = revPct >= 100
                    ? { label: 'План выполнен', cls: 'bg-emerald-500/20 text-emerald-400', icon: TrendingUp }
                    : revPct >= 50
                      ? { label: 'В работе', cls: 'bg-blue-500/20 text-blue-400', icon: Clock }
                      : { label: 'Отстаёт', cls: 'bg-red-500/20 text-red-400', icon: AlertTriangle }

                  return (
                    <div key={m.id} className="glass rounded-xl overflow-hidden">
                      <button
                        onClick={() => handleExpand(m.id, m.company_id)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                            {m.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-white text-sm">{m.name}</p>
                            <p className="text-xs text-white/40">{m.position} · {m.company_name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="hidden md:flex items-center gap-4 text-xs">
                            <span className="text-white/60">
                              Выручка: <span className="text-emerald-400 font-medium">{formatMoney(m.revenue_fact)}</span>
                              {m.revenue_plan > 0 && <span className={cn('ml-1 font-semibold', revPct >= 100 ? 'text-emerald-400' : revPct >= 50 ? 'text-blue-400' : 'text-red-400')}>({revPct}%)</span>}
                            </span>
                            <span className="text-white/60">
                              Сделки: <span className="text-white font-medium">{m.deals_paid}</span>
                            </span>
                            <span className="text-white/60">
                              Встречи: <span className="text-white font-medium">{m.meetings_fact}</span>
                            </span>
                          </div>

                          <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap', statusIcon.cls)}>
                            {statusIcon.label}
                          </span>

                          {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-white/5 pt-4">
                          <div className="space-y-3 mb-5">
                            <ProgressBar label="Выручка" value={m.revenue_fact} max={m.revenue_plan} percent={revPct} formatValue={formatMoney} />
                            {isBondaCompany
                              ? <ProgressBar label="ФинДиры" value={m.fd_count} max={m.findir_plan} percent={fdPct} />
                              : <ProgressBar label="Лицензии" value={m.units_fact} max={m.units_plan} percent={unitsPct} />
                            }
                            <ProgressBar label="Встречи" value={m.meetings_fact} max={m.meetings_plan} percent={meetPct} />
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                            {/* Сделки */}
                            <div className="bg-white/5 rounded-lg p-3">
                              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Сделки (оплач.)</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-emerald-400/70">Оплачено</span>
                                  <span className="text-emerald-400 font-medium">{m.deals_paid}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-white/50">Выручка</span>
                                  <span className="text-emerald-400 font-medium">{formatMoney(m.revenue_fact)}</span>
                                </div>
                                {m.revenue_plan > 0 && (
                                  <div className="flex justify-between pt-1 border-t border-white/5">
                                    <span className="text-white/30">План</span>
                                    <span className="text-white/50 font-medium">{formatMoney(m.revenue_plan)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Встречи */}
                            <div className="bg-white/5 rounded-lg p-3">
                              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Встречи</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-white/50">Новые</span>
                                  <span className="text-white font-medium">{m.meetings_new}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-white/50">Повторные</span>
                                  <span className="text-white font-medium">{m.meetings_repeat}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-white/50">Запланировано</span>
                                  <span className="text-white/70 font-medium">{m.meetings_scheduled}</span>
                                </div>
                                {m.meetings_plan > 0 && (
                                  <div className="flex justify-between pt-1 border-t border-white/5">
                                    <span className="text-white/30">План</span>
                                    <span className="text-white/50 font-medium">{m.meetings_plan}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Точки / Продукты */}
                            <div className="bg-white/5 rounded-lg p-3">
                              {isBondaCompany ? (
                                <>
                                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Продукты</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-emerald-400/70">ФинДир</span>
                                      <span className="text-emerald-400 font-medium">{m.fd_count} шт.</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-400/70">Bonda BI</span>
                                      <span className="text-blue-400 font-medium">{m.bi_count} шт.</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-orange-400/70">Разовые</span>
                                      <span className="text-orange-400 font-medium">{m.ot_count} шт.</span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Лицензии / Маржа</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-emerald-400/70">Оплачено</span>
                                      <span className="text-emerald-400 font-medium">{m.units_fact} шт.</span>
                                    </div>
                                    {m.units_plan > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-white/30">План</span>
                                        <span className="text-white/50 font-medium">{m.units_plan} шт.</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between pt-1 border-t border-white/5">
                                      <span className="text-orange-400/70">Маржа оборуд.</span>
                                      <span className="text-orange-400 font-medium">{formatMoney(m.margin_fact)}</span>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Финансы из встреч */}
                            <div className="bg-white/5 rounded-lg p-3">
                              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Счета / Оплаты</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-white/50">Выставлено</span>
                                  <span className="text-white font-medium">{formatMoney(m.invoiced_sum)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-emerald-400/70">Собрано</span>
                                  <span className="text-emerald-400 font-medium">{formatMoney(m.paid_sum)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* KPI Approvals */}
                          <div className="mb-5">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">KPI{isBondaCompany ? ' — БОНДА' : ''}</p>
                            <div className="bg-white/5 rounded-lg p-4">
                              {kpiLoading === m.id ? (
                                <div className="flex items-center gap-2 text-sm text-white/40">
                                  <Loader2 className="w-4 h-4 animate-spin" /> Загрузка...
                                </div>
                              ) : kpiData[m.id] ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/60">
                                      {isJunior ? 'Встречи (KPI записи)' : 'Чек-апы (KPI записи)'}
                                    </span>
                                    <span className={cn(
                                      'font-semibold',
                                      kpiData[m.id].entries.length >= (isJunior ? 5 : 12)
                                        ? 'text-emerald-400' : 'text-white'
                                    )}>
                                      {kpiData[m.id].entries.length} / {isJunior ? 5 : 12}
                                    </span>
                                  </div>
                                  {isJunior ? (
                                    <button
                                      onClick={() => handleToggleApproval(m.id, 'attestation', m.company_id)}
                                      className="flex items-center gap-2 text-sm hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition w-full text-left"
                                    >
                                      {kpiData[m.id].approvals.some((a: any) => a.kpi_type === 'attestation')
                                        ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        : <Circle className="w-5 h-5 text-white/20" />
                                      }
                                      <span className="text-white/70">Аттестация пройдена</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleToggleApproval(m.id, 'conversion_approved', m.company_id)}
                                      className="flex items-center gap-2 text-sm hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition w-full text-left"
                                    >
                                      {kpiData[m.id].approvals.some((a: any) => a.kpi_type === 'conversion_approved')
                                        ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        : <Circle className="w-5 h-5 text-white/20" />
                                      }
                                      <span className="text-white/70">Конверсия одобрена</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-white/30">Нет данных</p>
                              )}
                            </div>
                          </div>

                          {/* Recent paid deals */}
                          {m.recent_deals && m.recent_deals.filter((d: any) => d.status === 'paid').length > 0 && (
                            <div>
                              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Последние оплаченные сделки</p>
                              <div className="bg-white/5 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-white/5">
                                      <th className="px-3 py-2 text-left text-white/30 font-medium">Клиент</th>
                                      <th className="px-3 py-2 text-right text-white/30 font-medium">Сумма</th>
                                      <th className="px-3 py-2 text-right text-white/30 font-medium">Лицензии</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {m.recent_deals.filter((d: any) => d.status === 'paid').map((d: any, idx: number) => (
                                      <tr key={idx} className="border-b border-white/5 last:border-0">
                                        <td className="px-3 py-2 text-white/70">{d.client_name}</td>
                                        <td className="px-3 py-2 text-right text-emerald-400 font-medium">{formatMoney(d.revenue)}</td>
                                        <td className="px-3 py-2 text-right text-white/60">{d.units}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* =================== ПРОГНОЗ TAB =================== */}
          {activeTab === 'forecast' && (
            <>
              {/* Summary cards — Прогноз */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl glass p-4">
                  <p className="text-xs text-blue-400 mb-1">Прогноз (неоплач.)</p>
                  <p className="text-xl font-bold text-white">{formatMoney(totalRevForecast)}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{totalForecastDeals} сделок</p>
                </div>
                <div className="rounded-xl glass p-4">
                  <p className="text-xs text-amber-400 mb-1">Ждёт оплаты</p>
                  <p className="text-xl font-bold text-amber-400">{formatMoney(totalRevWaiting)}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{totalDealsWaiting} сделок • {totalUnitsWaiting} лиц.</p>
                </div>
                <div className="rounded-xl glass p-4">
                  <p className="text-xs text-white/40 mb-1">Без счёта</p>
                  <p className="text-xl font-bold text-white/60">{formatMoney(totalRevNoInvoice)}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{totalDealsNoInvoice} сделок</p>
                </div>
                <div className="rounded-xl glass p-4">
                  <p className="text-xs text-emerald-400 mb-1">Итого если всё закроется</p>
                  <p className="text-xl font-bold text-blue-400">{formatMoney(totalRevTotal)}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {paidPercent}% уже оплачено
                  </p>
                </div>
              </div>

              {/* Forecast progress bars */}
              <div className="glass rounded-xl p-5 mb-6">
                <h2 className="text-sm font-semibold text-white mb-3">Прогресс к плану (факт + прогноз)</h2>
                <div className="space-y-4">
                  {/* Выручка — always shown */}
                  <ForecastDualBar
                    label="Выручка"
                    fact={totalRevFact}
                    forecast={totalRevForecast}
                    plan={totalPlan}
                    formatValue={formatMoney}
                  />

                  {/* Лицензии ИННО — shown for Все and ИННО */}
                  {(isFilterAll || isFilterInno) && (
                    <ForecastDualBar
                      label={isFilterAll ? 'Лицензии ИННО' : 'Лицензии'}
                      fact={isFilterAll ? factUnitsInno : totalUnitsFact}
                      forecast={isFilterAll ? forecastUnitsInno : forecastUnitsFiltered}
                      plan={isFilterAll ? planUnitsInno : totalUnitsP}
                    />
                  )}

                  {/* ФинДиры БОНДА — shown for Все and БОНДА */}
                  {(isFilterAll || isFilterBonda) && (
                    <ForecastDualBar
                      label={isFilterAll ? 'ФинДиры БОНДА' : 'ФинДиры'}
                      fact={isFilterAll ? factFdBonda : totalFdCount}
                      forecast={isFilterAll ? forecastFdBonda : forecastFdFiltered}
                      plan={isFilterAll ? planFdBonda : totalFdPlan}
                    />
                  )}

                  <div className="flex gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Оплачено</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400/50"></span> Прогноз</span>
                  </div>
                </div>
              </div>

              {/* Individual forecast cards */}
              <div className="space-y-4">
                {filtered
                  .filter(m => (m.forecast_deals?.length || 0) > 0)
                  .sort((a, b) => b.revenue_forecast - a.revenue_forecast)
                  .map(m => {
                    const isExpanded = expandedId === m.id
                    const isBondaCompany = m.company_name?.toUpperCase()?.includes('БОНД') || false
                    const forecastDeals = m.forecast_deals || []
                    const waitingDeals = forecastDeals.filter((d: any) => d.status === 'waiting_payment')
                    const noInvoiceDeals = forecastDeals.filter((d: any) => d.status === 'no_invoice')
                    const potentialTotal = m.revenue_fact + m.revenue_forecast
                    const potentialPct = m.revenue_plan > 0 ? Math.round((potentialTotal / m.revenue_plan) * 100) : 0

                    return (
                      <div key={m.id} className="glass rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : m.id)}
                          className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                              {m.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-white text-sm">{m.name}</p>
                              <p className="text-xs text-white/40">{m.position} · {m.company_name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-4 text-xs">
                              <span className="text-white/60">
                                Прогноз: <span className="text-blue-400 font-medium">{formatMoney(m.revenue_forecast)}</span>
                              </span>
                              <span className="text-white/60">
                                Сделок: <span className="text-white font-medium">{forecastDeals.length}</span>
                              </span>
                              {m.revenue_plan > 0 && (
                                <span className={cn(
                                  'text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap',
                                  potentialPct >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                                )}>
                                  Потенциал {potentialPct}%
                                </span>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-white/5 pt-4">
                            {/* Summary row */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              <div className="bg-white/5 rounded-lg p-3 text-center">
                                <p className="text-[10px] text-amber-400/70 mb-1">Ждёт оплаты</p>
                                <p className="text-sm font-bold text-amber-400">{formatMoney(waitingDeals.reduce((s: number, d: any) => s + Number(d.revenue || 0) + Number(d.impl_revenue || 0) + Number(d.content_revenue || 0), 0))}</p>
                                <p className="text-[10px] text-white/30">{waitingDeals.length} сделок</p>
                              </div>
                              <div className="bg-white/5 rounded-lg p-3 text-center">
                                <p className="text-[10px] text-white/40 mb-1">Без счёта</p>
                                <p className="text-sm font-bold text-white/60">{formatMoney(noInvoiceDeals.reduce((s: number, d: any) => s + Number(d.revenue || 0) + Number(d.impl_revenue || 0) + Number(d.content_revenue || 0), 0))}</p>
                                <p className="text-[10px] text-white/30">{noInvoiceDeals.length} сделок</p>
                              </div>
                              <div className="bg-white/5 rounded-lg p-3 text-center">
                                <p className="text-[10px] text-blue-400/70 mb-1">Потенциал</p>
                                <p className="text-sm font-bold text-blue-400">{formatMoney(potentialTotal)}</p>
                                {m.revenue_plan > 0 && <p className="text-[10px] text-white/30">из {formatMoney(m.revenue_plan)} плана</p>}
                              </div>
                            </div>

                            {/* Potential progress bar */}
                            {m.revenue_plan > 0 && (
                              <div className="mb-4">
                                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden relative">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 absolute left-0 top-0"
                                    style={{ width: `${Math.min(Math.round(m.revenue_fact / m.revenue_plan * 100), 100)}%` }}
                                  />
                                  <div
                                    className="h-full bg-gradient-to-r from-blue-400/50 to-blue-500/50 absolute top-0"
                                    style={{
                                      left: `${Math.min(Math.round(m.revenue_fact / m.revenue_plan * 100), 100)}%`,
                                      width: `${Math.min(Math.round(m.revenue_forecast / m.revenue_plan * 100), 100 - Math.min(Math.round(m.revenue_fact / m.revenue_plan * 100), 100))}%`
                                    }}
                                  />
                                </div>
                                <div className="flex justify-between text-[10px] text-white/30 mt-1">
                                  <span>Оплач. {Math.round(m.revenue_fact / m.revenue_plan * 100)}%</span>
                                  <span>Потенциал {potentialPct}%</span>
                                </div>
                              </div>
                            )}

                            {/* Deals table */}
                            <div className="bg-white/5 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-white/10 bg-white/5">
                                    <th className="px-3 py-2.5 text-left text-white/30 font-medium">Клиент</th>
                                    <th className="px-3 py-2.5 text-right text-white/30 font-medium">Выручка</th>
                                    {isBondaCompany && <th className="px-3 py-2.5 text-right text-white/30 font-medium">MRR</th>}
                                    <th className="px-3 py-2.5 text-center text-white/30 font-medium">Лицензии</th>
                                    <th className="px-3 py-2.5 text-center text-white/30 font-medium">Статус</th>
                                    <th className="px-3 py-2.5 text-center text-white/30 font-medium">План. оплата</th>
                                    <th className="px-3 py-2.5 text-left text-white/30 font-medium">Заметки</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {forecastDeals.map((d: any, idx: number) => {
                                    const stColor = d.status === 'waiting_payment' ? 'text-amber-400' : 'text-white/40'
                                    const stLabel = d.status === 'waiting_payment' ? 'Ждёт оплаты' : 'Без счёта'
                                    return (
                                      <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                                        <td className="px-3 py-2.5 text-white font-medium">{d.client_name}</td>
                                        <td className="px-3 py-2.5 text-right text-white font-medium">{formatMoney(d.revenue)}</td>
                                        {isBondaCompany && <td className="px-3 py-2.5 text-right text-blue-400">{d.mrr ? formatMoney(d.mrr) : '—'}</td>}
                                        <td className="px-3 py-2.5 text-center text-white/60">{d.units}</td>
                                        <td className={cn('px-3 py-2.5 text-center font-medium text-[11px]', stColor)}>{stLabel}</td>
                                        <td className="px-3 py-2.5 text-center text-blue-400">{formatDate(d.planned_payment_date)}</td>
                                        <td className="px-3 py-2.5 text-white/40 truncate max-w-[180px]">{d.notes || ''}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                {/* Managers with no forecast deals */}
                {filtered.filter(m => (m.forecast_deals?.length || 0) === 0).length > 0 && (
                  <div className="glass rounded-xl p-4">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Нет неоплаченных сделок</p>
                    <div className="flex flex-wrap gap-2">
                      {filtered.filter(m => (m.forecast_deals?.length || 0) === 0).map(m => (
                        <span key={m.id} className="text-xs text-white/40 bg-white/5 px-3 py-1.5 rounded-lg">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {filtered.length === 0 && (
            <div className="text-center text-white/40 py-12">Нет сотрудников</div>
          )}
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
