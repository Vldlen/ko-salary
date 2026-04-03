import type { Deal, Meeting, MotivationSchema, OneTimePayment } from '@/types/database'

interface CalcInput {
  schema: MotivationSchema
  deals: Deal[]
  meetings: Meeting[]
  oneTimePayments: OneTimePayment[]
  individualPlan?: {
    revenue_plan?: number | null
    units_plan?: number | null
  }
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
  total: number
  forecast_total: number
  breakdown: {
    revenue_fact: number
    revenue_forecast: number
    revenue_plan: number
    revenue_percent: number
    revenue_forecast_percent: number
    units_fact: number
    units_plan: number
    units_percent: number
    meetings_fact: number
    meetings_plan: number
    meetings_percent: number
    margin_total: number
    push_bonus_raw: number
    implementation_revenue: number
    one_time_bonuses: number
    one_time_deductions: number
    multiplier_tier: string
  }
}

// Default ИННО push-bonus percentages
const DEFAULT_PUSH_PERCENTS = {
  month: 0.50,
  quarter: 0.80,
  half_year: 1.10,
  year: 1.50,
}

// Default threshold multiplier tiers
const DEFAULT_THRESHOLD_TIERS = {
  min_percent: 70,
  tiers: [
    { from: 0, to: 69, multiplier: 0 },
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
  const paidDeals = deals.filter(d => d.status === 'paid')
  const forecastDeals = deals.filter(d => d.status !== 'cancelled')

  const revenueFact = paidDeals.reduce((sum, d) => sum + Number(d.revenue), 0)
  const revenueForecast = forecastDeals.reduce((sum, d) => {
    return sum + Number(d.forecast_revenue ?? d.revenue)
  }, 0)

  const revenuePlan = individualPlan?.revenue_plan ?? config.revenue_plan
  const revenuePercent = revenuePlan > 0 ? revenueFact / revenuePlan : 0
  const revenueForecastPercent = revenuePlan > 0 ? revenueForecast / revenuePlan : 0

  // --- Units ---
  const unitsFact = paidDeals.reduce((sum, d) => sum + d.units, 0)
  const unitsPlan = individualPlan?.units_plan ?? config.units_plan
  const unitsPercent = unitsPlan > 0 ? unitsFact / unitsPlan : 0

  // --- Meetings ---
  const meetingsFact = meetings.reduce((sum, m) => sum + m.new_completed + m.repeat_completed, 0)
  const meetingsPlan = config.meetings_plan
  const meetingsPercent = meetingsPlan > 0 ? meetingsFact / meetingsPlan : 0

  // --- KPI Quality (meetings-based) ---
  let kpiQuality = 0
  if (config.kpi_quality.enabled) {
    kpiQuality = Math.min(
      meetingsPercent * config.kpi_quality.max_amount,
      config.kpi_quality.max_amount
    )
  }

  // --- KPI Quantity (units-based) ---
  let kpiQuantity = 0
  if (config.kpi_quantity.enabled) {
    kpiQuantity = Math.min(
      unitsPercent * config.kpi_quantity.max_amount,
      config.kpi_quantity.max_amount
    )
  }

  // --- Push-bonus: % от MRR нового клиента по периоду подписки ---
  const pushPercents = config.push_bonus_percents || DEFAULT_PUSH_PERCENTS
  let pushBonusRaw = 0

  // Push-bonus считается только для оплаченных лицензий (inno_license или без product_type)
  for (const deal of paidDeals) {
    if (deal.product_type === 'inno_implementation') continue // внедрение отдельно
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
    if (deal.product_type === 'inno_implementation') continue
    if (deal.product_type === 'findir' || deal.product_type === 'bonda_bi' || deal.product_type === 'one_time_service') continue
    const mrr = Number(deal.mrr || 0)
    if (mrr > 0) {
      const pct = getPushPercent(deal.subscription_period, pushPercents)
      forecastPushBonusRaw += mrr * pct
    }
  }

  // --- Услуги по внедрению: % от выручки ---
  const implPercent = config.implementation_percent ?? 0.10
  const implDeals = paidDeals.filter(d => d.product_type === 'inno_implementation')
  const implRevenue = implDeals.reduce((sum, d) => sum + Number(d.revenue), 0)
  const implementationBonus = implRevenue * implPercent

  const forecastImplDeals = forecastDeals.filter(d => d.product_type === 'inno_implementation')
  const forecastImplRevenue = forecastImplDeals.reduce((sum, d) => sum + Number(d.revenue), 0)
  const forecastImplementationBonus = forecastImplRevenue * implPercent

  // --- Margin bonus (железо) ---
  let marginBonus = 0
  if (config.margin_bonus.enabled) {
    const marginTotal = paidDeals.reduce((sum, d) => sum + Number(d.equipment_margin), 0)
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
  const unitsPctInt = Math.round(unitsPercent * 100)
  const revPctInt = Math.round(revenuePercent * 100)

  // Если есть оба плана, берём plan по лицензиям (основной KPI для ИННО)
  // Если только revenue plan — используем его
  const primaryPct = unitsPlan > 0 ? unitsPctInt : revPctInt
  const { multiplier, label: multiplierLabel } = getMultiplier(primaryPct, thresholdConfig)

  // Множитель применяется к push-бонусу
  const pushBonus = pushBonusRaw * multiplier
  const forecastPushBonus = forecastPushBonusRaw * multiplier

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
    total: Math.round(total),
    forecast_total: Math.round(forecastTotal),
    breakdown: {
      revenue_fact: revenueFact,
      revenue_forecast: revenueForecast,
      revenue_plan: revenuePlan,
      revenue_percent: Math.round(revenuePercent * 100),
      revenue_forecast_percent: Math.round(revenueForecastPercent * 100),
      units_fact: unitsFact,
      units_plan: unitsPlan,
      units_percent: Math.round(unitsPercent * 100),
      meetings_fact: meetingsFact,
      meetings_plan: meetingsPlan,
      meetings_percent: Math.round(meetingsPercent * 100),
      margin_total: marginTotal,
      push_bonus_raw: Math.round(pushBonusRaw),
      implementation_revenue: implRevenue,
      one_time_bonuses: oneTimeBonuses,
      one_time_deductions: oneTimeDeductions,
      multiplier_tier: multiplierLabel,
    }
  }
}
