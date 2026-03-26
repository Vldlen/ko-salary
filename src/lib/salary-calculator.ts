import type { Deal, Meeting, MotivationSchema, OneTimePayment } from '@/types/database'

interface CalcInput {
  schema: MotivationSchema
  deals: Deal[]
  meetings: Meeting[]
  oneTimePayments: OneTimePayment[]
}

interface CalcResult {
  base_salary: number
  kpi_quality: number
  kpi_quantity: number
  margin_bonus: number
  extra_bonus: number
  deduction: number
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
    one_time_bonuses: number
    one_time_deductions: number
  }
}

export function calculateSalary(input: CalcInput): CalcResult {
  const { schema, deals, meetings, oneTimePayments } = input
  const config = schema.config

  // --- Revenue ---
  const paidDeals = deals.filter(d => d.status === 'paid')
  const forecastDeals = deals.filter(d => d.status !== 'cancelled')

  const revenueFact = paidDeals.reduce((sum, d) => sum + Number(d.revenue), 0)
  const revenueForecast = forecastDeals.reduce((sum, d) => {
    return sum + Number(d.forecast_revenue ?? d.revenue)
  }, 0)
  const revenuePlan = config.revenue_plan
  const revenuePercent = revenuePlan > 0 ? revenueFact / revenuePlan : 0
  const revenueForecastPercent = revenuePlan > 0 ? revenueForecast / revenuePlan : 0

  // --- Units ---
  const unitsFact = paidDeals.reduce((sum, d) => sum + d.units, 0)
  const unitsPlan = config.units_plan
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

  // --- Margin bonus ---
  let marginBonus = 0
  if (config.margin_bonus.enabled) {
    const marginTotal = paidDeals.reduce((sum, d) => sum + Number(d.equipment_margin), 0)
    marginBonus = marginTotal * config.margin_bonus.percent
  }

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
  const total = baseSalary + kpiQuality + kpiQuantity + marginBonus + oneTimeBonuses - oneTimeDeductions

  // --- Forecast total (same formula but with forecast revenue/units) ---
  const forecastUnits = forecastDeals.reduce((sum, d) => sum + d.units, 0)
  const forecastUnitsPercent = unitsPlan > 0 ? forecastUnits / unitsPlan : 0
  const forecastMeetingsPercent = meetingsPercent // meetings are already known

  let forecastKpiQuality = 0
  if (config.kpi_quality.enabled) {
    forecastKpiQuality = Math.min(
      forecastMeetingsPercent * config.kpi_quality.max_amount,
      config.kpi_quality.max_amount
    )
  }

  let forecastKpiQuantity = 0
  if (config.kpi_quantity.enabled) {
    forecastKpiQuantity = Math.min(
      forecastUnitsPercent * config.kpi_quantity.max_amount,
      config.kpi_quantity.max_amount
    )
  }

  let forecastMarginBonus = 0
  if (config.margin_bonus.enabled) {
    const forecastMarginTotal = forecastDeals.reduce((sum, d) => sum + Number(d.equipment_margin), 0)
    forecastMarginBonus = forecastMarginTotal * config.margin_bonus.percent
  }

  const forecastTotal = baseSalary + forecastKpiQuality + forecastKpiQuantity + forecastMarginBonus + oneTimeBonuses - oneTimeDeductions

  // --- Margin total for breakdown ---
  const marginTotal = paidDeals.reduce((sum, d) => sum + Number(d.equipment_margin), 0)

  return {
    base_salary: Math.round(baseSalary),
    kpi_quality: Math.round(kpiQuality),
    kpi_quantity: Math.round(kpiQuantity),
    margin_bonus: Math.round(marginBonus),
    extra_bonus: Math.round(oneTimeBonuses),
    deduction: Math.round(oneTimeDeductions),
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
      one_time_bonuses: oneTimeBonuses,
      one_time_deductions: oneTimeDeductions,
    }
  }
}
