'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import type { UserRole } from '@/types/database'
import {
  LayoutDashboard, Handshake, CalendarDays, Wallet,
  TrendingUp, Users, Building2, UserCog, CalendarRange, Target, LogOut, Menu, X, ScrollText
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

const leaderLinks = [
  { href: '/team', label: 'Команда', icon: Users },
  { href: '/admin/plans', label: 'Планы', icon: Target },
  { href: '/admin/periods', label: 'Периоды', icon: CalendarRange },
]

const adminLinks = [
  { href: '/admin/users', label: 'Сотрудники', icon: UserCog },
  { href: '/admin/positions', label: 'Должности', icon: Building2 },
  { href: '/admin/audit', label: 'Журнал', icon: ScrollText },
]

type LinkSection = { title: string; links: typeof managerLinks }

function Sidebar({ role, userName, companyName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useSupabase()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Собираем секции по роли
  const sections: LinkSection[] = []

  // Все роли видят полный основной блок
  sections.push({ title: '', links: managerLinks })

  if (['rop', 'director', 'admin', 'founder'].includes(role)) {
    sections.push({ title: 'Руководство', links: leaderLinks })
  }
  if (role === 'admin') {
    sections.push({ title: 'Администрирование', links: adminLinks })
  }

  const roleLabel =
    role === 'admin' ? 'Администратор' :
    role === 'director' ? 'Директор по продажам' :
    role === 'rop' ? 'РОП' :
    role === 'founder' ? 'Фаундер' : 'Менеджер'

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold text-white">Пульс</h1>
            <p className="text-[10px] text-blue-400 uppercase tracking-wider">ком. отдела</p>
          </div>
        </div>
        {/* Close button - mobile only */}
        <button onClick={() => setOpen(false)} className="lg:hidden p-1 text-white/50 hover:text-white" aria-label="Закрыть меню">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {sections.map((section, idx) => (
          <div key={idx} className={idx > 0 ? 'mt-4' : ''}>
            {section.title && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.links.map(link => {
                const Icon = link.icon
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                    )}
                  >
                    <Icon className={cn('w-5 h-5', isActive ? 'text-blue-400' : '')} />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
            {userName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-white/40">{roleLabel}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-white/30 hover:text-red-400 transition" title="Выйти" aria-label="Выйти из аккаунта">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-sidebar px-4 py-3 flex items-center gap-3">
        <button onClick={() => setOpen(true)} className="p-1 text-white/70 hover:text-white" aria-label="Открыть меню">
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-heading font-bold text-white text-sm">Пульс КО</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar - desktop: always visible, fixed */}
      <aside className={cn(
        'glass-sidebar h-screen flex flex-col z-50',
        // Desktop
        'hidden lg:flex lg:w-64 lg:fixed lg:top-0 lg:left-0',
      )}>
        {sidebarContent}
      </aside>
      {/* Spacer to offset main content from fixed sidebar */}
      <div className="hidden lg:block lg:w-64 lg:flex-shrink-0" />

      {/* Mobile drawer */}
      <aside className={cn(
        'lg:hidden fixed top-0 left-0 h-full w-72 glass-sidebar flex flex-col z-50',
        'transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>
    </>
  )
}

export default memo(Sidebar)
