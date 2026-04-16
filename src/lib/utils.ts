import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' \u20BD'
}

export function formatPercent(value: number): string {
  return `${value}%`
}

export function getMonthName(month: number): string {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]
  return months[month - 1] || ''
}

export function getDealStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    no_invoice: 'Нет счёта',
    waiting_payment: 'Жду оплату',
    partial: 'Частично оплачено',
    paid: 'Оплачено',
  }
  return labels[status] || status
}

export function getDealStatusColor(status: string): string {
  const colors: Record<string, string> = {
    no_invoice: 'bg-white/10 text-white/60',
    waiting_payment: 'bg-orange-500/20 text-orange-400',
    partial: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-emerald-500/20 text-emerald-400',
  }
  return colors[status] || 'bg-white/10 text-white/60'
}

// ======== БОНДА helpers ========

export function getProductTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    findir: 'ФинДир',
    bonda_bi: 'Bonda BI',
    one_time_service: 'Разовая услуга',
    inno_license: 'Лицензия inno',
    inno_implementation: 'Внедрение',
    inno_content: 'Контент',
  }
  return labels[type] || type
}

export function getSubscriptionPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    month: 'Месяц',
    quarter: 'Квартал',
    half_year: 'Полгода',
    year: 'Год',
  }
  return labels[period] || period
}

// ======== Position helpers ========

/**
 * Определяет, является ли должность "младшим менеджером".
 * Единая точка логики — вместо дублирования `.includes('младш')` по всему коду.
 * TODO: заменить на флаг `is_junior` в таблице positions после миграции БД.
 */
export function checkIsJunior(positionName: string | null | undefined): boolean {
  if (!positionName) return false
  return positionName.toLowerCase().includes('младш')
}

// ======== MRR calculation ========

const PERIOD_MONTHS: Record<string, number> = {
  month: 1,
  quarter: 3,
  half_year: 6,
  year: 12,
}

/**
 * Вычисляет MRR (Monthly Recurring Revenue) из суммы и периода подписки.
 * Работает для ИННО (лицензии) и БОНДА (FinDir, Bonda BI).
 * Разовые услуги (one_time_service) → MRR = 0.
 *
 * @param revenue — сумма оплаты за период
 * @param subscriptionPeriod — 'month' | 'quarter' | 'half_year' | 'year' | null
 * @param productType — тип продукта (опционально, для исключения разовых услуг)
 */
export function calcMrr(
  revenue: number,
  subscriptionPeriod: string | null | undefined,
  productType?: string | null
): number {
  if (!revenue || revenue <= 0) return 0
  if (productType === 'one_time_service') return 0
  if (!subscriptionPeriod) return revenue // нет периода — считаем как month
  const months = PERIOD_MONTHS[subscriptionPeriod] || 1
  return Math.round(revenue / months)
}

// ======== Login & Password generation ========

const TRANSLIT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}

function transliterate(text: string): string {
  return text.toLowerCase().split('').map(c => TRANSLIT[c] ?? c).join('')
}

/**
 * Генерирует логин из ФИО: "Петров Владлен Игоревич" → "v.petrov"
 * Если такой занят (existingLogins), пробует "vl.petrov", "vla.petrov" и т.д.
 */
export function generateLogin(fullName: string, existingLogins: string[]): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) {
    // Только фамилия — используем как есть
    const base = transliterate(parts[0])
    if (!existingLogins.includes(base)) return base
    for (let i = 1; i <= 99; i++) {
      const candidate = `${base}${i}`
      if (!existingLogins.includes(candidate)) return candidate
    }
    return base
  }

  const surname = transliterate(parts[0]) // Петров → petrov
  const firstName = transliterate(parts[1]) // Владлен → vladlen

  // Пробуем v.petrov, vl.petrov, vla.petrov ...
  for (let len = 1; len <= firstName.length; len++) {
    const candidate = `${firstName.slice(0, len)}.${surname}`
    if (!existingLogins.includes(candidate)) return candidate
  }

  // Если все варианты заняты, добавляем цифру
  for (let i = 1; i <= 99; i++) {
    const candidate = `${firstName[0]}.${surname}${i}`
    if (!existingLogins.includes(candidate)) return candidate
  }

  return `${firstName[0]}.${surname}`
}

/**
 * Генерирует криптографически стойкий пароль: 10 символов (буквы + цифры + спецсимвол).
 * Пример: "kT7x$mR2pN"
 */
export function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'  // без I, O (путаются с 1, 0)
  const lower = 'abcdefghjkmnpqrstuvwxyz'    // без i, l, o
  const digits = '23456789'                   // без 0, 1
  const special = '$#@!'
  const all = upper + lower + digits

  // Криптографически безопасный random (работает и в Node, и в Edge Runtime)
  const randomBytes = new Uint8Array(12)
  crypto.getRandomValues(randomBytes)

  // Гарантируем наличие каждого класса символов
  const pick = (charset: string, byte: number) => charset[byte % charset.length]
  const parts = [
    pick(upper, randomBytes[0]),
    pick(lower, randomBytes[1]),
    pick(digits, randomBytes[2]),
    pick(special, randomBytes[3]),
  ]

  // Остальные 6 символов — из общего набора
  for (let i = 4; i < 10; i++) {
    parts.push(pick(all, randomBytes[i]))
  }

  // Перемешиваем (Fisher-Yates с crypto random)
  for (let i = parts.length - 1; i > 0; i--) {
    const j = randomBytes[i + 2] % (i + 1)
    ;[parts[i], parts[j]] = [parts[j], parts[i]]
  }

  return parts.join('')
}
