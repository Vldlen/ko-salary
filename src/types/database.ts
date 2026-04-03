export type UserRole = 'admin' | 'director' | 'rop' | 'manager' | 'founder'
export type PeriodStatus = 'draft' | 'active' | 'closed'
export type DealStatus = 'no_invoice' | 'waiting_payment' | 'paid' | 'cancelled'
export type PaymentType = 'bonus' | 'deduction'
export type ProductType = 'findir' | 'bonda_bi' | 'one_time_service' | 'inno_license' | 'inno_implementation'
export type SubscriptionPeriod = 'month' | 'quarter' | 'half_year' | 'year'

export interface Company {
  id: string
  name: string
  created_at: string
}

export interface Position {
  id: string
  name: string
  company_id: string
  created_at: string
}

export interface MotivationConfig {
  // Планы (ИННО)
  revenue_plan: number        // план выручки (₽)
  units_plan: number          // план по штукам
  meetings_plan: number       // план встреч
  // Проценты от дохода (ИННО)
  revenue_percent: number     // % от выручки
  mrr_percent: number         // % от MRR
  // KPI качественный (конверсия встреч)
  kpi_quality: {
    enabled: boolean
    description: string
    max_amount: number
    conversion_threshold: number // порог конверсии (%) для получения бонуса
  }
  // KPI количественный (штуки)
  kpi_quantity: {
    enabled: boolean
    description: string
    max_amount: number
  }
  // Маржа с оборудования (ИННО)
  margin_bonus: {
    enabled: boolean
    description: string
    percent: number
  }
  // Аттестация
  attestation: {
    enabled: boolean
    bonus_amount: number      // бонус за сданную аттестацию
  }
  // === ИННО push-bonus ===
  push_bonus_percents?: {            // % от MRR нового клиента по периоду подписки
    month: number                    // 0.50 = 50%
    quarter: number                  // 0.80 = 80%
    half_year: number                // 1.10 = 110%
    year: number                     // 1.50 = 150%
  }
  implementation_percent?: number    // % за услуги внедрения (0.10 = 10%)
  // === Пороговые множители (ИННО) ===
  threshold_multipliers?: {
    min_percent: number              // порог начисления (70 = 70%)
    tiers: Array<{                   // множители по диапазонам
      from: number                   // от % (включительно)
      to: number                     // до % (включительно, 999 = бесконечность)
      multiplier: number             // множитель (0, 1, 1.2, 1.5)
    }>
  }
  // === БОНДА-specific ===
  kpi_max_amount?: number           // бонус за KPI (по умолчанию 10000)
  kpi_entries_target?: number       // порог KPI записей для менеджера (12)
  kpi_entries_target_junior?: number // порог KPI записей для младшего (5)
  fd_threshold?: number             // порог переключения ставки ФД (4 шт)
  fd_percent_low?: number           // % ФД до порога (0.075 = 7.5%)
  fd_percent_high?: number          // % ФД после порога (0.15 = 15%)
  one_time_service_percent?: number // % за разовые услуги (0.10 = 10%)
  bi_percents?: {                   // проценты Bonda BI по периодам
    month: number
    quarter: number
    half_year: number
    year: number
  }
}

export interface MotivationSchema {
  id: string
  position_id: string
  name: string
  base_salary: number
  valid_from: string
  valid_to: string | null
  config: MotivationConfig
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  company_id: string | null
  position_id: string | null
  is_active: boolean
  created_at: string
  // joined
  company?: Company
  position?: Position
}

export interface Period {
  id: string
  company_id: string
  year: number
  month: number
  status: PeriodStatus
  created_at: string
}

export interface Deal {
  id: string
  user_id: string
  period_id: string
  client_name: string
  revenue: number
  mrr: number
  units: number
  status: DealStatus
  equipment_margin: number
  equipment_sell_price: number
  equipment_buy_price: number
  is_forecast: boolean
  forecast_revenue: number | null
  forecast_close_date: string | null
  notes: string | null
  amo_link: string | null
  planned_payment_date: string | null
  paid_at: string | null
  product_type: ProductType | null
  subscription_period: SubscriptionPeriod | null
  created_at: string
  updated_at: string
}

export interface KpiEntry {
  id: string
  user_id: string
  period_id: string
  entry_date: string
  client_name: string
  amo_link: string | null
  product: string | null
  comment: string | null
  created_at: string
}

export interface KpiApproval {
  id: string
  user_id: string
  period_id: string
  kpi_type: string   // 'attestation' | 'conversion_approved'
  approved_by: string | null
  approved_at: string
}

export interface Meeting {
  id: string
  user_id: string
  period_id: string
  date: string
  scheduled: number
  new_completed: number
  repeat_completed: number
  mentor: number
  next_day: number
  rescheduled: number
  invoiced_sum: number
  paid_sum: number
  created_at: string
}

export interface SalaryResult {
  id: string
  user_id: string
  period_id: string
  base_salary: number
  kpi_quality: number
  kpi_quantity: number
  margin_bonus: number
  extra_bonus: number
  deduction: number
  total: number
  forecast_total: number
  breakdown: Record<string, unknown>
  calculated_at: string
}

export interface OneTimePayment {
  id: string
  user_id: string
  period_id: string
  amount: number
  type: PaymentType
  description: string
  created_at: string
}

export interface IndividualPlan {
  id: string
  user_id: string
  period_id: string
  company_id: string
  revenue_plan: number | null     // ИННО: план выручки
  units_plan: number | null       // ИННО + БОНДА: план штук
  mrr_plan: number | null         // ИННО: план MRR
  findir_plan: number | null      // БОНДА: план ФИНДИРов
  created_at: string
  updated_at: string
}

// Aggregated views
export interface ManagerSummary {
  user: User
  period: Period
  deals_count: number
  total_revenue: number
  total_mrr: number
  total_units: number
  forecast_revenue: number
  meetings_total: number
  meetings_new: number
  meetings_repeat: number
  salary: SalaryResult | null
  schema: MotivationSchema | null
}
