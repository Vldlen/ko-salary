// ======== Статусы сделок ========
export const DEAL_STATUS = {
  NO_INVOICE: 'no_invoice',
  WAITING_PAYMENT: 'waiting_payment',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const

export type DealStatus = typeof DEAL_STATUS[keyof typeof DEAL_STATUS]

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  [DEAL_STATUS.NO_INVOICE]: 'Нет счёта',
  [DEAL_STATUS.WAITING_PAYMENT]: 'Жду оплату',
  [DEAL_STATUS.PARTIAL]: 'Частично оплачено',
  [DEAL_STATUS.PAID]: 'Оплачено',
}

// ======== Статусы периодов ========
export const PERIOD_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
} as const

export type PeriodStatus = typeof PERIOD_STATUS[keyof typeof PERIOD_STATUS]

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  [PERIOD_STATUS.DRAFT]: 'Черновик',
  [PERIOD_STATUS.ACTIVE]: 'Активный',
  [PERIOD_STATUS.CLOSED]: 'Закрыт',
}

// ======== Роли пользователей ========
export const USER_ROLE = {
  MANAGER: 'manager',
  ROP: 'rop',
  DIRECTOR: 'director',
  ADMIN: 'admin',
  FOUNDER: 'founder',
} as const

export type UserRoleType = typeof USER_ROLE[keyof typeof USER_ROLE]

export const USER_ROLE_LABELS: Record<UserRoleType, string> = {
  [USER_ROLE.MANAGER]: 'Менеджер',
  [USER_ROLE.ROP]: 'РОП',
  [USER_ROLE.DIRECTOR]: 'Директор по продажам',
  [USER_ROLE.ADMIN]: 'Администратор',
  [USER_ROLE.FOUNDER]: 'Учредитель',
}

// ======== Месяцы ========
export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export const MONTH_NAMES_SHORT = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
]
