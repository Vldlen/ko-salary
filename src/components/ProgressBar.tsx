import { cn } from '@/lib/utils'

interface ProgressBarProps {
  label: string
  value: number
  max?: number
  percent?: number
  formatValue?: (v: number) => string
  className?: string
}

export default function ProgressBar({ label, value, max, percent, formatValue, className }: ProgressBarProps) {
  const displayValue = formatValue ? formatValue(value) : String(value)
  const hasTarget = max != null && max > 0 && percent != null
  const displayMax = hasTarget ? (formatValue ? formatValue(max!) : String(max)) : null
  const pct = hasTarget ? percent! : 0
  const clampedPercent = Math.min(pct, 100)

  const barColor = pct >= 100
    ? 'from-emerald-400 to-emerald-500'
    : pct >= 50
    ? 'from-blue-400 to-blue-500'
    : 'from-orange-400 to-orange-500'

  const glowColor = pct >= 100
    ? 'shadow-emerald-400/40'
    : pct >= 50
    ? 'shadow-blue-400/40'
    : 'shadow-orange-400/40'

  const badgeColor = pct >= 100
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : pct >= 50
    ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
    : 'bg-orange-500/15 text-orange-400 border-orange-500/20'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-white/50">{label}</span>
        <span className="font-medium text-white">
          {displayValue}
          {hasTarget && (
            <>
              {' / '}{displayMax}
              <span className={cn(
                'ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full border',
                badgeColor
              )}>
                {pct}%
              </span>
            </>
          )}
        </span>
      </div>
      {hasTarget && (
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden border border-white/[0.04]">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r shadow-lg',
              barColor,
              glowColor
            )}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      )}
      {!hasTarget && (
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden border border-white/[0.04]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-blue-400 to-blue-500 shadow-lg shadow-blue-400/40"
            style={{ width: '100%', opacity: 0.5 }}
          />
        </div>
      )}
    </div>
  )
}
