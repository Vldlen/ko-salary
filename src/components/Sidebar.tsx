'use client'

import { memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import {
  LayoutDashboard, Handshake, CalendarDays, Wallet,
  TrendingUp, Users, Settings, Building2, UserCog, CalendarRange, LogOut
} from 'lucide-react'

interface SidebarProps {
  role: UserRole
  userName: string
  companyName: string
}

const managerLinks = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/deals', label: 'Сделки', icon: Handshake },
  { href: '/meetings', label: 'Встречи', icon: CalendarDays },
  { href: '/salary', label: 'Моя ЗП', icon: Wallet },
  { href: '/forecast', label: 'Прогноз', icon: TrendingUp },
]

const ropLinks = [
  { href: '/team', label: 'Команда', icon: Users },
]

const adminLinks = [
  { href: '/admin/users', label: 'Сотрудники', icon: UserCog },
  { href: '/admin/positions', label: 'Должности', icon: Building2 },
  { href: '/admin/periods', label: 'Периоды', icon: CalendarRange },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
]

function Sidebar({ role, userName, companyName }: SidebarProps) {
  const pathname = usePathname()

  const links = [
    ...managerLinks,
    ...((['rop', 'director', 'admin'] as UserRole[]).includes(role) ? ropLinks : []),
    ...((['admin', 'director'] as UserRole[]).includes(role) ? adminLinks : []),
  ]

  return (
    <aside className="w-64 glass-sidebar min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-brand-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold text-brand-900">Пульс</h1>
            <p className="text-[10px] text-brand-300 uppercase tracking-wider">ком. отдела</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(link => {
          const Icon = link.icon
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-50 text-brand-500 shadow-sm'
                  : 'text-gray-500 hover:bg-brand-50 hover:text-brand-400'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-brand-500' : '')} />
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-brand-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-accent flex items-center justify-center text-white font-bold text-sm">
            {userName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-900 truncate">{userName}</p>
            <p className="text-xs text-gray-400">{
              role === 'admin' ? 'Администратор' :
              role === 'director' ? 'Комдир' :
              role === 'rop' ? 'РОП' : 'Менеджер'
            }</p>
          </div>
          <button className="p-1.5 text-gray-300 hover:text-red-400 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default memo(Sidebar)
