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
  const iconBg = {
    default: 'bg-blue-500/20 text-blue-400',
    accent: 'bg-orange-500/20 text-orange-400',
    success: 'bg-emerald-500/20 text-emerald-400',
  }

  return (
    <div className={cn(
      'glass rounded-2xl p-5 hover:bg-white/[0.08] transition-all',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-sm text-white/40 mt-0.5">{subtitle}</p>}
          {trend && (
            <p className={cn(
              'text-sm font-medium mt-1',
              trend.positive ? 'text-emerald-400' : 'text-red-400'
            )}>
              {trend.positive ? '\u2191' : '\u2193'} {trend.value}
            </p>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
