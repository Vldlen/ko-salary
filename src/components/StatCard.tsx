import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: { value: string; positive: boolean }
  variant?: 'default' | 'accent' | 'success'
  className?: string
}

export default function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default', className }: StatCardProps) {
  const iconStyles = {
    default: 'bg-blue-500/15 text-blue-400 shadow-blue-500/10',
    accent: 'bg-orange-500/15 text-orange-400 shadow-orange-500/10',
    success: 'bg-emerald-500/15 text-emerald-400 shadow-emerald-500/10',
  }

  return (
    <div className={cn(
      'glass glass-hover rounded-2xl p-3 lg:p-5',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="relative z-[1]">
          <p className="text-xs lg:text-sm text-white/50">{title}</p>
          <p className="text-lg lg:text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs lg:text-sm text-white/40 mt-0.5">{subtitle}</p>}
          {trend && (
            <p className={cn(
              'text-sm font-medium mt-1',
              trend.positive ? 'text-emerald-400' : 'text-red-400'
            )}>
              {trend.positive ? '\u2191' : '\u2193'} {trend.value}
            </p>
          )}
        </div>
        <div className={cn(
          'w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center shadow-lg relative z-[1]',
          iconStyles[variant]
        )}>
          <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
        </div>
      </div>
    </div>
  )
}
