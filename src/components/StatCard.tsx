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
    default: 'bg-brand-50 text-brand-500',
    accent: 'bg-accent-light text-accent',
    success: 'bg-green-50 text-green-600',
  }

  return (
    <div className={cn(
      'glass rounded-2xl p-5 hover:shadow-md transition-shadow',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
          {trend && (
            <p className={cn(
              'text-sm font-medium mt-1',
              trend.positive ? 'text-green-600' : 'text-red-500'
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
