import { cn } from '@/lib/utils'

interface ProgressBarProps {
  label: string
  value: number
  max: number
  percent: number
  formatValue?: (v: number) => string
  className?: string
}

export default function ProgressBar({ label, value, max, percent, formatValue, className }: ProgressBarProps) {
  const displayValue = formatValue ? formatValue(value) : String(value)
  const displayMax = formatValue ? formatValue(max) : String(max)
  const clampedPercent = Math.min(percent, 100)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-white/50">{label}</span>
        <span className="font-medium text-white">
          {displayValue} / {displayMax}
          <span className={cn(
            'ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
            percent >= 100 ? 'bg-emerald-500/20 text-emerald-400' :
            percent >= 50 ? 'bg-blue-500/20 text-blue-400' :
            'bg-orange-500/20 text-orange-400'
          )}>
            {percent}%
          </span>
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            percent >= 100
              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              : percent >= 50
              ? 'bg-gradient-to-r from-blue-400 to-blue-500'
              : 'bg-gradient-to-r from-orange-400 to-orange-500'
          )}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  )
}
