'use client'

import { memo } from 'react'

// Цвета сегментов для ИННО пирога
const SEGMENT_COLORS = {
  license: '#3b82f6',    // blue-500
  impl: '#8b5cf6',       // violet-500
  content: '#f59e0b',    // amber-500
  equipment: '#10b981',  // emerald-500
}

// Цвета и метки для БОНДА
const BONDA_TYPES: Record<string, { label: string; bg: string; text: string }> = {
  findir:           { label: 'ФД', bg: '#a855f7', text: '#ffffff' },   // purple-500
  bonda_bi:         { label: 'BI', bg: '#06b6d4', text: '#ffffff' },   // cyan-500
  one_time_service: { label: 'РУ', bg: '#f97316', text: '#ffffff' },   // orange-500
}

interface DealIconProps {
  deal: {
    revenue?: number | null
    impl_revenue?: number | null
    content_revenue?: number | null
    equipment_margin?: number | null
    product_type?: string | null
  }
  isBonda: boolean
  size?: number
}

/** Mini pie chart for ИННО deals, colored badge for БОНДА */
function DealIcon({ deal, isBonda, size = 40 }: DealIconProps) {
  if (isBonda) {
    const info = BONDA_TYPES[deal.product_type || 'findir'] || BONDA_TYPES.findir
    return (
      <div
        className="flex items-center justify-center rounded-full font-bold shrink-0"
        style={{ width: size, height: size, backgroundColor: info.bg, color: info.text, fontSize: size * 0.35 }}
      >
        {info.label}
      </div>
    )
  }

  // ИННО: pie chart segments
  const segments: { value: number; color: string; label: string }[] = []

  const license = Number(deal.revenue || 0)
  const impl = Number(deal.impl_revenue || 0)
  const content = Number(deal.content_revenue || 0)
  const equipment = Number(deal.equipment_margin || 0)

  if (license > 0) segments.push({ value: license, color: SEGMENT_COLORS.license, label: 'Лицензия' })
  if (impl > 0) segments.push({ value: impl, color: SEGMENT_COLORS.impl, label: 'Внедрение' })
  if (content > 0) segments.push({ value: content, color: SEGMENT_COLORS.content, label: 'Контент' })
  if (equipment > 0) segments.push({ value: equipment, color: SEGMENT_COLORS.equipment, label: 'Оборуд.' })

  // Fallback — if no segments, show a plain circle
  if (segments.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-blue-500/30 shrink-0"
        style={{ width: size, height: size }}
      >
        <div className="w-2 h-2 rounded-full bg-blue-400" />
      </div>
    )
  }

  // If only one segment, full circle
  if (segments.length === 1) {
    return (
      <div
        className="rounded-full shrink-0"
        style={{ width: size, height: size, backgroundColor: segments[0].color }}
      />
    )
  }

  // Multiple segments — SVG pie
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const r = size / 2
  const cx = r
  const cy = r
  const innerR = r * 0.35 // donut hole

  let startAngle = -90 // start from top

  const paths = segments.map((seg) => {
    const angle = (seg.value / total) * 360
    const endAngle = startAngle + angle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)

    const ix1 = cx + innerR * Math.cos(startRad)
    const iy1 = cy + innerR * Math.sin(startRad)
    const ix2 = cx + innerR * Math.cos(endRad)
    const iy2 = cy + innerR * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ')

    startAngle = endAngle

    return <path key={seg.label} d={d} fill={seg.color} />
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      style={{ borderRadius: '50%' }}
    >
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={r} fill="#1e293b" />
      {paths}
      {/* Inner hole */}
      <circle cx={cx} cy={cy} r={innerR} fill="#0f172a" />
    </svg>
  )
}

export default memo(DealIcon)
