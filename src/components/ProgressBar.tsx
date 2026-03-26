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
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-brand-900">
          {displayValue} / {displayMax}
          <span className={cn(
            'ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
            percent >= 100 ? 'bg-green-100 text-green-700' :
            percent >= 50 ? 'bg-brand-50 text-brand-500' :
            'bg-accent-light text-accent'
          )}>
            {percent}%
          </span>
        </span>
      </div>
      <div className="h-2 bg-brand-50 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            percent >= 100
              ? 'bg-gradient-to-r from-green-400 to-green-500'
              : percent >= 50
              ? 'bg-gradient-to-r from-brand-300 to-brand-500'
              : 'bg-gradient-to-r from-accent/70 to-accent'
          )}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  )
}
