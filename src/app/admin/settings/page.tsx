'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Settings, Save, Plus, ChevronDown, ChevronUp, Briefcase } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import {
  getPositions, getCompanies, getMotivationSchemas,
  createMotivationSchema, updateMotivationSchema
} from '@/lib/supabase/admin-queries'
import type { MotivationConfig } from '@/types/database'

const DEFAULT_CONFIG: MotivationConfig = {
  revenue_plan: 500000,
  units_plan: 10,
  meetings_plan: 20,
  revenue_percent: 0,
  mrr_percent: 0,
  kpi_quality: { enabled: true, description: 'Качественный KPI (конверсия встреч)', max_amount: 15000, conversion_threshold: 30 },
  kpi_quantity: { enabled: true, description: 'Количественный KPI (штуки)', max_amount: 10000 },
  margin_bonus: { enabled: true, description: 'Маржа с оборудования', percent: 0.094 },
  attestation: { enabled: false, bonus_amount: 5000 },
}

function formatNum(n: number): string {
  return n.toLocaleString('ru-RU')
}

export default function AdminSettingsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [positions, setPositions] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [schemas, setSchemas] = useState<any[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null)
  const [editConfigs, setEditConfigs] = useState<Record<string, { baseSalary: number; name: string; config: MotivationConfig }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newSchema, setNewSchema] = useState({ position_id: '', name: '', base_salary: 30000 })

  const loadData = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser(supabase)
      if (!currentUser) { router.push('/login'); return }
      if (!['admin', 'director'].includes(currentUser.role)) { router.push('/dashboard'); return }
      setUser(currentUser)

      const [posData, compData, schemaData] = await Promise.all([
        getPositions(supabase),
        getCompanies(supabase),
        getMotivationSchemas(supabase),
      ])
      setPositions(posData)
      setCompanies(compData)
      setSchemas(schemaData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  function startEdit(schema: any) {
    const config = { ...DEFAULT_CONFIG, ...schema.config }
    setEditConfigs(prev => ({
      ...prev,
      [schema.id]: {
        baseSalary: schema.base_salary,
        name: schema.name,
        config,
      }
    }))
    setExpandedSchema(schema.id)
  }

  function updateConfig(schemaId: string, path: string, value: any) {
    setEditConfigs(prev => {
      const edit = { ...prev[schemaId] }
      const cfg = { ...edit.config } as any

      const parts = path.split('.')
      if (parts.length === 1) {
        cfg[parts[0]] = value
      } else {
        cfg[parts[0]] = { ...cfg[parts[0]], [parts[1]]: value }
      }
      edit.config = cfg
      return { ...prev, [schemaId]: edit }
    })
  }

  async function saveSchema(schemaId: string) {
    const edit = editConfigs[schemaId]
    if (!edit) return
    setSaving(schemaId)
    try {
      await updateMotivationSchema(supabase, schemaId, {
        name: edit.name,
        base_salary: edit.baseSalary,
        config: edit.config as any,
      })
      const schemaData = await getMotivationSchemas(supabase)
      setSchemas(schemaData)
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  async function handleCreate() {
    if (!newSchema.position_id || !newSchema.name) return
    setSaving('new')
    try {
      await createMotivationSchema(supabase, {
        position_id: newSchema.position_id,
        name: newSchema.name,
        base_salary: newSchema.base_salary,
        valid_from: new Date().toISOString().slice(0, 10),
        config: DEFAULT_CONFIG as any,
      })
      const schemaData = await getMotivationSchemas(supabase)
      setSchemas(schemaData)
      setShowCreate(false)
      setNewSchema({ position_id: '', name: '', base_salary: 30000 })
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>

  const filteredSchemas = selectedCompany === 'all'
    ? schemas
    : schemas.filter((s: any) => s.position?.company?.name === companies.find((c: any) => c.id === selectedCompany)?.name)

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={user?.role || 'admin'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Settings className="w-7 h-7 text-blue-400" />
              <h1 className="text-2xl font-heading font-bold text-white">Настройки KPI</h1>
            </div>
            <button onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition">
              {showCreate ? 'Отмена' : <><Plus className="w-4 h-4" /> Новая схема</>}
            </button>
          </div>

          {/* Company filter */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setSelectedCompany('all')}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition',
                selectedCompany === 'all' ? 'bg-blue-500/20 text-blue-400' : 'text-white/40 hover:text-white/70')}>
              Все
            </button>
            {companies.map((c: any) => (
              <button key={c.id} onClick={() => setSelectedCompany(c.id)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition',
                  selectedCompany === c.id ? 'bg-blue-500/20 text-blue-400' : 'text-white/40 hover:text-white/70')}>
                {c.name}
              </button>
            ))}
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="glass rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">Новая схема мотивации</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Должность</label>
                  <select value={newSchema.position_id} onChange={e => setNewSchema(p => ({ ...p, position_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none">
                    <option value="">Выбрать</option>
                    {positions.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.company?.name} — {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Название</label>
                  <input type="text" value={newSchema.name} onChange={e => setNewSchema(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none"
                    placeholder="Стандарт Q2 2026" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Оклад ₽</label>
                  <input type="number" value={newSchema.base_salary} onChange={e => setNewSchema(p => ({ ...p, base_salary: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                </div>
              </div>
              <button onClick={handleCreate} disabled={saving === 'new' || !newSchema.position_id || !newSchema.name}
                className="bg-blue-400 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                {saving === 'new' ? 'Создаю...' : 'Создать'}
              </button>
            </div>
          )}

          {/* Schemas list */}
          {filteredSchemas.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Briefcase className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Нет схем мотивации</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSchemas.map((schema: any) => {
                const isExpanded = expandedSchema === schema.id
                const edit = editConfigs[schema.id]
                const cfg: MotivationConfig = edit?.config || { ...DEFAULT_CONFIG, ...schema.config }

                return (
                  <div key={schema.id} className="glass rounded-2xl overflow-hidden">
                    {/* Schema header — clickable */}
                    <button
                      onClick={() => isExpanded ? setExpandedSchema(null) : startEdit(schema)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-white font-semibold">{schema.name}</p>
                          <p className="text-xs text-white/40">
                            {schema.position?.company?.name} → {schema.position?.name}
                          </p>
                        </div>
                        <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                          Оклад: {formatNum(schema.base_salary)} ₽
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                          {schema.config?.kpi_quality?.enabled && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">KPI кач.</span>}
                          {schema.config?.kpi_quantity?.enabled && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">KPI кол.</span>}
                          {schema.config?.margin_bonus?.enabled && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Маржа</span>}
                          {schema.config?.attestation?.enabled && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Аттест.</span>}
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-white/30" /> : <ChevronDown className="w-5 h-5 text-white/30" />}
                      </div>
                    </button>

                    {/* Expanded config editor */}
                    {isExpanded && edit && (
                      <div className="px-6 pb-6 border-t border-white/5 pt-5">
                        {/* Base info */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div>
                            <label className="block text-xs text-white/40 mb-1">Название схемы</label>
                            <input type="text" value={edit.name}
                              onChange={e => setEditConfigs(prev => ({ ...prev, [schema.id]: { ...prev[schema.id], name: e.target.value } }))}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-white/40 mb-1">Оклад ₽</label>
                            <input type="number" value={edit.baseSalary}
                              onChange={e => setEditConfigs(prev => ({ ...prev, [schema.id]: { ...prev[schema.id], baseSalary: Number(e.target.value) } }))}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-white/40 mb-1">Действует с</label>
                            <input type="text" value={schema.valid_from} disabled
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/30 outline-none" />
                          </div>
                        </div>

                        {/* Percents */}
                        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Проценты от дохода</h3>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                            <label className="block text-xs text-white/40 mb-1">% от выручки</label>
                            <input type="number" step="0.1" value={cfg.revenue_percent}
                              onChange={e => updateConfig(schema.id, 'revenue_percent', Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-white/40 mb-1">% от MRR</label>
                            <input type="number" step="0.1" value={cfg.mrr_percent}
                              onChange={e => updateConfig(schema.id, 'mrr_percent', Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                          </div>
                        </div>

                        {/* KPI Quality */}
                        <div className="glass rounded-xl p-4 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={cfg.kpi_quality.enabled}
                                  onChange={e => updateConfig(schema.id, 'kpi_quality.enabled', e.target.checked)}
                                  className="sr-only peer" />
                                <div className="w-9 h-5 bg-white/10 peer-checked:bg-emerald-500 rounded-full peer-focus:ring-2 peer-focus:ring-emerald-400/30 transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                              </label>
                              <span className="text-sm font-medium text-white">KPI качественный</span>
                              <span className="text-xs text-white/30">(конверсия встреч)</span>
                            </div>
                          </div>
                          {cfg.kpi_quality.enabled && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Макс. бонус ₽</label>
                                <input type="number" value={cfg.kpi_quality.max_amount}
                                  onChange={e => updateConfig(schema.id, 'kpi_quality.max_amount', Number(e.target.value))}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Порог конверсии %</label>
                                <input type="number" value={cfg.kpi_quality.conversion_threshold}
                                  onChange={e => updateConfig(schema.id, 'kpi_quality.conversion_threshold', Number(e.target.value))}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* KPI Quantity */}
                        <div className="glass rounded-xl p-4 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={cfg.kpi_quantity.enabled}
                                  onChange={e => updateConfig(schema.id, 'kpi_quantity.enabled', e.target.checked)}
                                  className="sr-only peer" />
                                <div className="w-9 h-5 bg-white/10 peer-checked:bg-blue-500 rounded-full peer-focus:ring-2 peer-focus:ring-blue-400/30 transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                              </label>
                              <span className="text-sm font-medium text-white">KPI количественный</span>
                              <span className="text-xs text-white/30">(штуки)</span>
                            </div>
                          </div>
                          {cfg.kpi_quantity.enabled && (
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Макс. бонус ₽</label>
                                <input type="number" value={cfg.kpi_quantity.max_amount}
                                  onChange={e => updateConfig(schema.id, 'kpi_quantity.max_amount', Number(e.target.value))}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Margin Bonus */}
                        <div className="glass rounded-xl p-4 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={cfg.margin_bonus.enabled}
                                  onChange={e => updateConfig(schema.id, 'margin_bonus.enabled', e.target.checked)}
                                  className="sr-only peer" />
                                <div className="w-9 h-5 bg-white/10 peer-checked:bg-orange-500 rounded-full peer-focus:ring-2 peer-focus:ring-orange-400/30 transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                              </label>
                              <span className="text-sm font-medium text-white">Маржа с оборудования</span>
                            </div>
                          </div>
                          {cfg.margin_bonus.enabled && (
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Процент маржи (0.094 = 9.4%)</label>
                                <input type="number" step="0.001" value={cfg.margin_bonus.percent}
                                  onChange={e => updateConfig(schema.id, 'margin_bonus.percent', Number(e.target.value))}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Attestation */}
                        <div className="glass rounded-xl p-4 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={cfg.attestation.enabled}
                                  onChange={e => updateConfig(schema.id, 'attestation.enabled', e.target.checked)}
                                  className="sr-only peer" />
                                <div className="w-9 h-5 bg-white/10 peer-checked:bg-purple-500 rounded-full peer-focus:ring-2 peer-focus:ring-purple-400/30 transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                              </label>
                              <span className="text-sm font-medium text-white">Аттестация</span>
                            </div>
                          </div>
                          {cfg.attestation.enabled && (
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Бонус за аттестацию ₽</label>
                                <input type="number" value={cfg.attestation.bonus_amount}
                                  onChange={e => updateConfig(schema.id, 'attestation.bonus_amount', Number(e.target.value))}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Save */}
                        <button onClick={() => saveSchema(schema.id)} disabled={saving === schema.id}
                          className="flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                          {saving === schema.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {saving === schema.id ? 'Сохраняю...' : 'Сохранить'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
