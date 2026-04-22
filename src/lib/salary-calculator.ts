import type { Deal, Meeting, MotivationSchema, OneTimePayment } from '@/types/database'
import { logger } from '@/lib/logger'

interface CalcInput {
  schema: MotivationSchema
  deals: Deal[]
  meetings: Meeting[]
  oneTimePayments: OneTimePayment[]
  individualPlan?: {
    revenue_plan?: number | null
    units_plan?: number | null
  }
  // KPI binary (как у БОНДА): записи + одобрение
  kpiEntriesCount?: number
  kpiApprovals?: string[]  // ['attestation', 'conversion_approved']
  isJunior?: boolean
}

interface CalcResult {
  base_salary: number
  kpi_quality: number
  kpi_quantity: number
  push_bonus: number
  implementation_bonus: number
  margin_bonus: number
  extra_bonus: number
  deduction: number
  multiplier: number
  forecast_multiplier: number
  services_multiplier: number
  forecast_services_multiplier: number
  total: number
  forecast_total: number
  breakdown: {
    revenue_fact: number
    revenue_forecast: number
    revenue_plan: number
    revenue_percent: number
    revenue_forecast_percent: number
    units_fact: number
    units_forecast: number
    units_plan: number
    units_percent: number
    units_forecast_percent: number
    meetings_fact: number
    meetings_plan: number
    meetings_percent: number
    margin_total: number
    push_bonus_raw: number
    implementation_revenue: number
    implementation_bonus_raw: number
    services_revenue_plan: number
    services_percent: number
    services_multiplier: number
    services_multiplier_tier: string
    one_time_bonuses: number
    one_time_deductions: number
    multiplier_tier: string
    forecast_multiplier: number
    forecast_multiplier_tier: string
    forecast_push_bonus_raw: number
    kpi_entries_count: number
    kpi_entries_target: number
    kpi_approval_type: string
    kpi_approval_done: boolean
  }
}

// Дефолтные значения ПРИМЕНЯЮТСЯ ТОЛЬКО если в schema.config соответствующий ключ не задан.
// Когда это происходит — в консоль пишется warning через logger, чтобы админ мог поправить
// конфигурацию должности вместо молчаливого расчёта по дефолту.
//
// Если тебе надо изменить эти числа на прод — правь schema.config у должности в /admin/positions,
// а НЕ этот файл.
const DEFAULT_PUSH_PERCENTS = {
  month: 0.50,
  quarter: 0.80,
  half_year: 1.10,
  year: 1.50,
}

const DEFAULT_THRESHOLD_TIERS = {
  min_percent: 30,
  tiers: [
    { from: 0, to: 29, multiplier: 0 },
    { from: 30, to: 69, multiplier: 0.5 },
    { from: 70, to: 100, multiplier: 1 },
    { from: 101, to: 120, multiplier: 1.2 },
    { from: 121, to: 999, multiplier: 1.5 },
  ],
}

function getMultiplier(percent: number, config: NonNullable<typeof DEFAULT_THRESHOLD_TIERS>): { multiplier: number; label: string } {
  for (const tier of config.tiers) {
    if (percent >= tier.from && percent <= tier.to) {
      return { multiplier: tier.multiplier, label: `${tier.from}-${tier.to === 999 ? '∞' : tier.to}% → x${tier.multiplier}` }
    }
  }
  return { multiplier: 0, label: '<70% → x0' }
}

// Map subscription_period to push-bonus percent key
function getPushPercent(subPeriod: string | null, percents: typeof DEFAULT_PUSH_PERCENTS): number {
  switch (subPeriod) {
    case 'month': return percents.month
    case 'quarter': return percents.quarter
    case 'half_year': return percents.half_year
    case 'year': return percents.year
    default: return percents.month
  }
}

export function calculateSalary(input: CalcInput): CalcResult {
  const { schema, deals, meetings, oneTimePayments, individualPlan } = input
  const config = schema.config

  // --- Revenue ---
  // Включаем paid И partial сделки в фактические расчёты
  const paidDeals = deals.filter(d => d.status === 'paid' || d.status === 'partial')
  const forecastDeals = deals.filter(d => d.status !== 'cancelled')

  // Для paid сделок берём полную сумму, для partial — оплаченную часть (paid_license)
  const revenueFact = paidDeals.reduce((sum, d) => {
    if (d.status === 'partial') return sum + Number((d as any).paid_license || 0)
    return sum + Number(d.revenue)
  }, 0)
  const revenueForecast = forecastDeals.reduce((sum, d) => {
    return sum + Number(d.forecast_revenue ?? d.revenue)
  }, 0)

  // Coalesce plans к 0 явно: individualPlan может вернуть null, config — undefined.
  // Все последующие деления защищены `plan > 0 ? ... : 0` на случай plan=0 (новый период без плана).
  const revenuePlan = Number(individualPlan?.revenue_plan ?? config.revenue_plan ?? 0) || 0
  const revenuePercent = revenuePlan > 0 ? revenueFact / revenuePlan : 0
  const revenueForecastPercent = revenuePlan > 0 ? revenueForecast / revenuePlan : 0

  // --- Units (лицензии) ---
  // Partial: лицензии считаются только если paid_license >= revenue (оплачена лицензия полностью)
  const unitsFact = paidDeals.reduce((sum, d) => {
    if (d.status === 'partial') {
      return sum + (Number((d as any).paid_license || 0) >= Number(d.revenue) ? d.units : 0)
    }
    return sum + d.units
  }, 0)
  const unitsForecast = forecastDeals.reduce((sum, d) => sum + d.units, 0)
  const unitsPlan = Number(individualPlan?.units_plan ?? config.units_plan ?? 0) || 0
  const unitsPercent = unitsPlan > 0 ? unitsFact / unitsPlan : 0
  const unitsForecastPercent = unitsPlan > 0 ? unitsForecast / unitsPlan : 0

  // --- Meetings ---
  const meetingsFact = meetings.reduce((sum, m) => sum + m.new_completed + m.repeat_completed, 0)
  const meetingsPlan = Number(config.meetings_plan ?? 0) || 0
  const meetingsPercent = meetingsPlan > 0 ? meetingsFact / meetingsPlan : 0

  // --- KPI (бинарный, как у БОНДА) ---
  const kpiEntriesCount = input.kpiEntriesCount ?? 0
  const kpiApprovals = input.kpiApprovals ?? []
  const isJunior = input.isJunior ?? false

  // KPI Quality = одобрение руководителем (аттестация для младшего, конверсия для менеджера)
  const kpiApprovalType = isJunior ? 'attestation' : 'conversion_approved'
  let kpiQuality = 0
  if (config.kpi_quality.enabled) {
    kpiQuality = kpiApprovals.includes(kpiApprovalType) ? config.kpi_quality.max_amount : 0
  }

  // KPI Quantity = записи (встречи/презентации): достиг порога → полный бонус
  const kpiEntriesTarget = isJunior
    ? (config.kpi_entries_target_junior ?? 5)
    : (config.kpi_entries_target ?? 20)

  let kpiQuantity = 0
  if (config.kpi_quantity.enabled) {
    kpiQuantity = kpiEntriesCount >= kpiEntriesTarget ? config.kpi_quantity.max_amount : 0
  }

  // --- Push-bonus: % от MRR нового клиента по периоду подписки ---
  let pushPercents = config.push_bonus_percents
  if (!pushPercents) {
    logger.warn(`[salary-calc] schema.config.push_bonus_percents не задан — используется дефолт (schema=${schema.id})`)
    pushPercents = DEFAULT_PUSH_PERCENTS
  }
  let pushBonusRaw = 0

  // Push-bonus считается только для оплаченных лицензий (inno_license или без product_type)
  for (const deal of paidDeals) {
    if (deal.product_type === 'inno_implementation' || deal.product_type === 'inno_content') continue // внедрение/контент отдельно
    if (deal.product_type === 'findir' || deal.product_type === 'bonda_bi' || deal.product_type === 'one_time_service') continue // БОНДА продукты
    const mrr = Number(deal.mrr || 0)
    if (mrr > 0) {
      const pct = getPushPercent(deal.subscription_period, pushPercents)
      pushBonusRaw += mrr * pct
    }
  }

  // --- Forecast push-bonus (for all non-cancelled deals) ---
  let forecastPushBonusRaw = 0
  for (const deal of forecastDeals) {
    if (deal.product_type === 'inno_implementation' || deal.product_type === 'inno_content') continue
    if (deal.product_type === 'findir' || deal.product_type === 'bonda_bi' || deal.product_type === 'one_time_service') continue
    const mrr = Number(deal.mrr || 0)
    if (mrr > 0) {
      const pct = getPushPercent(deal.subscription_period, pushPercents)
      forecastPushBonusRaw += mrr * pct
    }
  }

  // --- Услуги по внедрению + генерация контента: % от выручки × множитель ---
  const implPercent = config.implementation_percent ?? 0.10
  // Новые поля: impl_revenue, content_revenue на самой сделке
  // + обратная совместимость со старыми сделками по product_type
  const implRevenue = paidDeals.reduce((sum, d) => {
    if (d.status === 'partial') {
      // Partial: берём только оплаченные суммы внедрения и контента
      return sum + Number((d as any).paid_impl || 0) + Number((d as any).paid_content || 0)
    }
    let rev = Number(d.impl_revenue || 0) + Number(d.content_revenue || 0)
    // Обратная совместимость: старые сделки с product_type
    if (rev === 0 && (d.product_type === 'inno_implementation' || d.product_type === 'inno_content')) {
      rev = Number(d.revenue)
    }
    return sum + rev
  }, 0)

  const forecastImplRevenue = forecastDeals.reduce((sum, d) => {
    let rev = Number(d.impl_revenue || 0) + Number(d.content_revenue || 0)
    if (rev === 0 && (d.product_type === 'inno_implementation' || d.product_type === 'inno_content')) {
      rev = Number(d.revenue)
    }
    return sum + rev
  }, 0)

  // Множитель для услуг: по плану выручки услуг (revenue_plan)
  const servicesRevenuePlan = revenuePlan // revenue_plan = план по выручке услуг
  const servicesPercent = servicesRevenuePlan > 0 ? implRevenue / servicesRevenuePlan : 0
  const servicesPctInt = Math.round(servicesPercent * 100)
  let servicesThresholdConfig = config.threshold_multipliers
  if (!servicesThresholdConfig) {
    logger.warn(`[salary-calc] schema.config.threshold_multipliers не задан — используется дефолт (schema=${schema.id})`)
    servicesThresholdConfig = DEFAULT_THRESHOLD_TIERS
  }
  const { multiplier: servicesMultiplier, label: servicesMultiplierLabel } = getMultiplier(servicesPctInt, servicesThresholdConfig)

  // Прогнозный множитель услуг: по прогнозной выручке услуг
  const forecastServicesPercent = servicesRevenuePlan > 0 ? forecastImplRevenue / servicesRevenuePlan : 0
  const forecastServicesPctInt = Math.round(forecastServicesPercent * 100)
  const { multiplier: forecastServicesMultiplier } = getMultiplier(forecastServicesPctInt, servicesThresholdConfig)

  const implementationBonusRaw = implRevenue * implPercent
  const implementationBonus = implementationBonusRaw * servicesMultiplier
  const forecastImplementationBonusRaw = forecastImplRevenue * implPercent
  const forecastImplementationBonus = forecastImplementationBonusRaw * forecastServicesMultiplier

  // --- Margin bonus (железо) ---
  let marginBonus = 0
  if (config.margin_bonus.enabled) {
    const marginTotal = paidDeals.reduce((sum, d) => {
      if (d.status === 'partial') return sum + Number((d as any).paid_equipment || 0)
      return sum + Number(d.equipment_margin)
    }, 0)
    marginBonus = marginTotal * config.margin_bonus.percent
  }

  let forecastMarginBonus = 0
  if (config.margin_bonus.enabled) {
    const forecastMarginTotal = forecastDeals.reduce((sum, d) => sum + Number(d.equipment_margin), 0)
    forecastMarginBonus = forecastMarginTotal * config.margin_bonus.percent
  }

  // --- Threshold multiplier ---
  // Определяем % выполнения для множителя
  // Для лицензий используем units_percent, для выручки revenue_percent
  // Таблица говорит: пороги по оплатам и планам
  // Используем наименьший из двух (units и revenue), если оба плана заданы
  const thresholdConfig = config.threshold_multipliers || DEFAULT_THRESHOLD_TIERS
  // (warning уже выведен выше при servicesThresholdConfig — не дублируем)
  const unitsPctInt = Math.round(unitsPercent * 100)
  const revPctInt = Math.round(revenuePercent * 100)

  // Если есть оба плана, берём plan по лицензиям (основной KPI для ИННО)
  // Если только revenue plan — используем его
  const primaryPct = unitsPlan > 0 ? unitsPctInt : revPctInt
  const { multiplier, label: multiplierLabel } = getMultiplier(primaryPct, thresholdConfig)

  // Прогнозный множитель: считается по ПРОГНОЗНЫМ лицензиям (все неотменённые)
  const unitsForecastPctInt = Math.round(unitsForecastPercent * 100)
  const revForecastPctInt = Math.round(revenueForecastPercent * 100)
  const forecastPrimaryPct = unitsPlan > 0 ? unitsForecastPctInt : revForecastPctInt
  const { multiplier: forecastMultiplier, label: forecastMultiplierLabel } = getMultiplier(forecastPrimaryPct, thresholdConfig)

  // Множитель применяется к push-бонусу
  const pushBonus = pushBonusRaw * multiplier
  const forecastPushBonus = forecastPushBonusRaw * forecastMultiplier

  // --- One-time payments ---
  const oneTimeBonuses = oneTimePayments
    .filter(p => p.type === 'bonus')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const oneTimeDeductions = oneTimePayments
    .filter(p => p.type === 'deduction')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  // --- Base salary ---
  const baseSalary = schema.base_salary

  // --- Total ---
  // Железо начисляется ВСЕГДА (без порога)
  // Push-бонус — через множитель
  // KPI — фиксированный
  const total = baseSalary + kpiQuality + kpiQuantity + pushBonus + implementationBonus + marginBonus + oneTimeBonuses - oneTimeDeductions

  // --- Forecast total ---
  const forecastTotal = baseSalary + kpiQuality + kpiQuantity + forecastPushBonus + forecastImplementationBonus + forecastMarginBonus + oneTimeBonuses - oneTimeDeductions

  // --- Margin total for breakdown ---
  const marginTotal = paidDeals.reduce((sum, d) => sum + Number(d.equipment_margin), 0)

  return {
    base_salary: Math.round(baseSalary),
    kpi_quality: Math.round(kpiQuality),
    kpi_quantity: Math.round(kpiQuantity),
    push_bonus: Math.round(pushBonus),
    implementation_bonus: Math.round(implementationBonus),
    margin_bonus: Math.round(marginBonus),
    extra_bonus: Math.round(oneTimeBonuses),
    deduction: Math.round(oneTimeDeductions),
    multiplier,
    forecast_multiplier: forecastMultiplier,
    services_multiplier: servicesMultiplier,
    forecast_services_multiplier: forecastServicesMultiplier,
    total: Math.round(total),
    forecast_total: Math.round(forecastTotal),
    breakdown: {
      revenue_fact: revenueFact,
      revenue_forecast: revenueForecast,
      revenue_plan: revenuePlan,
      revenue_percent: Math.round(revenuePercent * 100),
      revenue_forecast_percent: Math.round(revenueForecastPercent * 100),
      units_fact: unitsFact,
      units_forecast: unitsForecast,
      units_plan: unitsPlan,
      units_percent: Math.round(unitsPercent * 100),
      units_forecast_percent: Math.round(unitsForecastPercent * 100),
      meetings_fact: meetingsFact,
      meetings_plan: meetingsPlan,
      meetings_percent: Math.round(meetingsPercent * 100),
      margin_total: marginTotal,
      push_bonus_raw: Math.round(pushBonusRaw),
      implementation_revenue: implRevenue,
      implementation_bonus_raw: Math.round(implementationBonusRaw),
      services_revenue_plan: servicesRevenuePlan,
      services_percent: servicesPctInt,
      services_multiplier: servicesMultiplier,
      services_multiplier_tier: servicesMultiplierLabel,
      one_time_bonuses: oneTimeBonuses,
      one_time_deductions: oneTimeDeductions,
      multiplier_tier: multiplierLabel,
      forecast_multiplier: forecastMultiplier,
      forecast_multiplier_tier: forecastMultiplierLabel,
      forecast_push_bonus_raw: Math.round(forecastPushBonusRaw),
      kpi_entries_count: kpiEntriesCount,
      kpi_entries_target: kpiEntriesTarget,
      kpi_approval_type: kpiApprovalType,
      kpi_approval_done: kpiApprovals.includes(kpiApprovalType),
    }
  }
}
