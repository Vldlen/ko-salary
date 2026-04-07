'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const selected = options.find(o => o.value === value)

  const updatePos = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      updatePos()
      window.addEventListener('scroll', updatePos, true)
      window.addEventListener('resize', updatePos)
      return () => {
        window.removeEventListener('scroll', updatePos, true)
        window.removeEventListener('resize', updatePos)
      }
    }
  }, [open, updatePos])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={btnRef}
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

      {open && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="rounded-xl bg-[#1a1f35] border border-white/15 shadow-2xl overflow-hidden"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false) }}
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
        </div>,
        document.body
      )}
    </div>
  )
}
