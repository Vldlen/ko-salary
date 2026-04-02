'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
  color?: string // optional colored dot
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

export default function CustomSelect({ value, onChange, options, placeholder = 'Выбрать...', className }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left transition-colors',
          open
            ? 'border-blue-400 bg-white/10 ring-2 ring-blue-400/30'
            : 'border-white/10 bg-white/5 hover:bg-white/8'
        )}
      >
        <span className="flex items-center gap-2">
          {selected?.color && (
            <span className={cn('w-2 h-2 rounded-full', selected.color)} />
          )}
          <span className={selected ? 'text-white' : 'text-white/30'}>
            {selected?.label || placeholder}
          </span>
        </span>
        <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-[#1a1f35] border border-white/15 shadow-2xl overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors',
                opt.value === value
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              {opt.color && (
                <span className={cn('w-2 h-2 rounded-full', opt.color)} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
