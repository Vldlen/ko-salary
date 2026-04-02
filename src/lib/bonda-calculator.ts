import type { Deal, SubscriptionPeriod } from '@/types/database'

// Коэффициенты за длинный контракт ФД
const FD_PERIOD_COEFF: Record<string, number> = {
  month: 1,
  quarter: 1.5,
  half_year: 2,
}

// Количество месяцев в периоде (для вычисления месячной части)
const PERIOD_MONTHS: Record<string, number> = {
  month: 1,
  quarter: 3,
  half_year: 6,
  year: 12,
}

// Проценты бонуса за Bonda BI по периодам (дефолт)
const DEFAULT_BI_PERCENT: Record<string, number> = {
  month: 0.5,
  quarter: 1.0,
  half_year: 1.5,
  year: 2.0,
}

export interface BondaCalcInput {
  deals: Deal[]
  kpiEntriesCount: number        // кол-во записей KPI (встречи/чекапы)
  kpiApprovals: string[]         // одобренные KPI типы: ['attestation', 'conversion_approved']
  baseSalary: number
  isJunior: boolean              // младший менеджер или менеджер
  kpiMaxAmount: number           // сумма за каждый KPI (обычно 10000)
  kpiEntriesTarget: number       // порог для KPI по записям (5 для младшего, 12 для менеджера)
  fdThreshold: number            // порог переключения % (4 шт)
  fdPercentLow: number           // % до порога (0.075)
  fdPercentHigh: number          // % после порога (0.15)
  oneTimeServicePercent: number  // % за разовые услуги (0.10)
  biPercents?: Record<string, number>  // проценты Bonda BI по периодам (из настроек должности)
}

export interface BondaCalcResult {
  base_salary: number
  kpi_total: number
  kpi_entries_bonus: number      // KPI за записи (встречи/чекапы)
  kpi_approval_bonus: number     // KPI за галочку руководителя
  push_bonus_fd: number
  push_bonus_bi: number
  push_bonus_one_time: number
  push_bonus_total: number
  total: number
  breakdown: {
    fd_count: number
    fd_rate_applied: number      // итоговый % (7.5 или 15)
    fd_deals: { client: string; revenue: number; period: string; bonus: number }[]
    bi_deals: { client: string; revenue: number; period: string; bonus: number }[]
    one_time_deals: { client: string; revenue: number; bonus: number }[]
    kpi_entries_count: number
    kpi_entries_target: number
  }
}

export function calculateBondaSalary(input: BondaCalcInput): BondaCalcResult {
  const {
    deals, kpiEntriesCount, kpiApprovals, baseSalary, isJunior,
    kpiMaxAmount, kpiEntriesTarget, fdThreshold,
    fdPercentLow, fdPercentHigh, oneTimeServicePercent,
    biPercents,
  } = input

  const BI_PERCENT = biPercents && Object.keys(biPercents).length > 0 ? biPercents : DEFAULT_BI_PERCENT

  const paidDeals = deals.filter(d => d.status === 'paid')

  // --- Считаем ФД ---
  const fdDeals = paidDeals.filter(d => d.product_type === 'findir')
  const fdCount = fdDeals.length

  // Определяем ставку: если 4+ ФД — все по высокой ставке
  const fdPercent = fdCount >= fdThreshold ? fdPercentHigh : fdPercentLow
  // Для младшего менеджера всегда высокая ставка (без порогов)
  const effectiveFdPercent = isJunior ? fdPercentHigh : fdPercent

  const fdBreakdown: BondaCalcResult['breakdown']['fd_deals'] = []
  let pushBonusFd = 0

  for (const deal of fdDeals) {
    const period = deal.subscription_period || 'month'
    const months = PERIOD_MONTHS[period] || 1
    const coeff = FD_PERIOD_COEFF[period] || 1
    const monthlyPart = Number(deal.revenue) / months
    const bonus = Math.round(monthlyPart * effectiveFdPercent * coeff)
    pushBonusFd += bonus
    fdBreakdown.push({
      client: deal.client_name,
      revenue: Number(deal.revenue),
      period,
      bonus,
    })
  }

  // --- Считаем Bonda BI ---
  const biDeals = paidDeals.filter(d => d.product_type === 'bonda_bi')
  const biBreakdown: BondaCalcResult['breakdown']['bi_deals'] = []
  let pushBonusBi = 0

  for (const deal of biDeals) {
    const period = deal.subscription_period || 'month'
    const months = PERIOD_MONTHS[period] || 1
    const percent = BI_PERCENT[period] || 0.5
    const monthlyPart = Number(deal.revenue) / months
    const bonus = Math.round(monthlyPart * percent)
    pushBonusBi += bonus
    biBreakdown.push({
      client: deal.client_name,
      revenue: Number(deal.revenue),
      period,
      bonus,
    })
  }

  // --- Считаем разовые услуги ---
  const oneTimeDeals = paidDeals.filter(d => d.product_type === 'one_time_service')
  const otBreakdown: BondaCalcResult['breakdown']['one_time_deals'] = []
  let pushBonusOneTime = 0

  for (const deal of oneTimeDeals) {
    const bonus = Math.round(Number(deal.revenue) * oneTimeServicePercent)
    pushBonusOneTime += bonus
    otBreakdown.push({
      client: deal.client_name,
      revenue: Number(deal.revenue),
      bonus,
    })
  }

  const pushBonusTotal = pushBonusFd + pushBonusBi + pushBonusOneTime

  // --- KPI ---
  // KPI за записи (встречи/чекапы): выполнил порог → получает бонус
  const kpiEntriesBonus = kpiEntriesCount >= kpiEntriesTarget ? kpiMaxAmount : 0

  // KPI за галочку руководителя
  let kpiApprovalBonus = 0
  if (isJunior) {
    // Младший: аттестация (разовая галочка)
    if (kpiApprovals.includes('attestation')) kpiApprovalBonus = kpiMaxAmount
  } else {
    // Менеджер: конверсия (ежемесячная галочка)
    if (kpiApprovals.includes('conversion_approved')) kpiApprovalBonus = kpiMaxAmount
  }

  const kpiTotal = kpiEntriesBonus + kpiApprovalBonus
  const total = baseSalary + kpiTotal + pushBonusTotal

  return {
    base_salary: baseSalary,
    kpi_total: kpiTotal,
    kpi_entries_bonus: kpiEntriesBonus,
    kpi_approval_bonus: kpiApprovalBonus,
    push_bonus_fd: pushBonusFd,
    push_bonus_bi: pushBonusBi,
    push_bonus_one_time: pushBonusOneTime,
    push_bonus_total: pushBonusTotal,
    total,
    breakdown: {
      fd_count: fdCount,
      fd_rate_applied: effectiveFdPercent * 100,
      fd_deals: fdBreakdown,
      bi_deals: biBreakdown,
      one_time_deals: otBreakdown,
      kpi_entries_count: kpiEntriesCount,
      kpi_entries_target: kpiEntriesTarget,
    },
  }
}
