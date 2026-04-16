'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Plus, X, Save, ChevronDown, ChevronUp, Clock, Briefcase } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import {
  getPositions, getCompanies,
  createPosition, getMotivationSchemas,
  createMotivationSchema, updateMotivationSchema
} from '@/lib/supabase/admin-queries'
import type { MotivationConfig } from '@/types/database'

const DEFAULT_CONFIG_INNO: MotivationConfig = {
  revenue_plan: 840000,
  units_plan: 20,
  meetings_plan: 20,
  revenue_percent: 0,
  mrr_percent: 0,
  kpi_quality: { enabled: true, description: 'KPI: Презентации inno (уникальные встречи)', max_amount: 10000, conversion_threshold: 35 },
  kpi_quantity: { enabled: true, description: 'KPI: Конверсия встреча-продажа', max_amount: 10000 },
  margin_bonus: { enabled: true, description: 'Маржа с оборудования (10%)', percent: 0.10 },
  attestation: { enabled: true, bonus_amount: 10000 },
  // ИННО push-bonus
  push_bonus_percents: { month: 0.50, quarter: 0.80, half_year: 1.10, year: 1.50 },
  implementation_percent: 0.10,
  // Пороговые множители
  threshold_multipliers: {
    min_percent: 70,
    tiers: [
      { from: 0, to: 69, multiplier: 0 },
      { from: 70, to: 100, multiplier: 1 },
      { from: 101, to: 120, multiplier: 1.2 },
      { from: 121, to: 999, multiplier: 1.5 },
    ],
  },
  // KPI entries
  kpi_entries_target: 20,
  kpi_entries_target_junior: 5,
}

const DEFAULT_CONFIG_BONDA: MotivationConfig = {
  revenue_plan: 0,
  units_plan: 0,
  meetings_plan: 20,
  revenue_percent: 0,
  mrr_percent: 0,
  kpi_quality: { enabled: false, description: '', max_amount: 0, conversion_threshold: 0 },
  kpi_quantity: { enabled: false, description: '', max_amount: 0 },
  margin_bonus: { enabled: false, description: '', percent: 0 },
  attestation: { enabled: true, bonus_amount: 10000 },
  // БОНДА
  kpi_max_amount: 10000,
  kpi_entries_target: 12,
  kpi_entries_target_junior: 5,
  fd_threshold: 4,
  fd_percent_low: 0.075,
  fd_percent_high: 0.15,
  one_time_service_percent: 0.10,
  bi_percents: { month: 0.5, quarter: 1.0, half_year: 1.5, year: 2.0 },
}

function getDefaultConfig(companyName?: string): MotivationConfig {
  if (companyName?.toUpperCase().includes('БОНД')) return DEFAULT_CONFIG_BONDA
  return DEFAULT_CONFIG_INNO
}

function isBondaCompany(companyName?: string): boolean {
  return !!companyName?.toUpperCase().includes('БОНД')
}

function formatNum(n: number): string {
  return n.toLocaleString('ru-RU')
}

export default function AdminPositionsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [positions, setPositions] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', company_id: '' })
  const [expandedPos, setExpandedPos] = useState<string | null>(null)
  const [editConfigs, setEditConfigs] = useState<Record<string, { baseSalary: number; name: string; config: MotivationConfig; validFrom: string }>>({})
  const [showNewSchema, setShowNewSchema] = useState<string | null>(null)
  const [newSchemaForm, setNewSchemaForm] = useState({ name: '', base_salary: 30000, valid_from: new Date().toISOString().slice(0, 10) })

  const loadData = useCallback(async () => {
    try {
      const user = await getCurrentUser(supabase)
      if (!user) { router.push('/login'); return }
      if (user.role !== 'admin') { router.push('/dashboard'); return }
      setCurrentUser(user)

      const [posData, compData] = await Promise.all([
        getPositions(supabase),
        getCompanies(supabase),
      ])
      setPositions(posData)
      setCompanies(compData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreatePosition(e: React.FormEvent) {
    e.preventDefault()
    setSaving('new-pos')
    try {
      await createPosition(supabase, form)
      const posData = await getPositions(supabase)
      setPositions(posData)
      setShowForm(false)
      setForm({ name: '', company_id: '' })
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // Получить актуальную (последнюю) схему для должности
  function getActiveSchema(position: any) {
    const schemas = position.motivation_schemas || []
    if (schemas.length === 0) return null
    // Сортируем по valid_from DESC — первая = актуальная
    return [...schemas].sort((a: any, b: any) => b.valid_from.localeCompare(a.valid_from))[0]
  }

  // Получить все схемы (история)
  function getAllSchemas(position: any) {
    const schemas = position.motivation_schemas || []
    return [...schemas].sort((a: any, b: any) => b.valid_from.localeCompare(a.valid_from))
  }

  function startEdit(schema: any, companyName?: string) {
    const defaults = getDefaultConfig(companyName)
    const config = { ...defaults, ...schema.config }
    setEditConfigs(prev => ({
      ...prev,
      [schema.id]: {
        baseSalary: schema.base_salary,
        name: schema.name,
        config,
        validFrom: schema.valid_from,
      }
    }))
  }

  function expandPosition(posId: string) {
    if (expandedPos === posId) {
      setExpandedPos(null)
      return
    }
    setExpandedPos(posId)
    const pos = positions.find((p: any) => p.id === posId)
    const schema = getActiveSchema(pos)
    if (schema) startEdit(schema, pos?.company?.name)
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
      const posData = await getPositions(supabase)
      setPositions(posData)
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  async function handleCreateSchema(positionId: string) {
    if (!newSchemaForm.name) return
    setSaving('new-schema')
    try {
      // Закрываем предыдущую схему (ставим valid_to = день до новой)
      const pos = positions.find((p: any) => p.id === positionId)
      const activeSchema = getActiveSchema(pos)
      if (activeSchema) {
        const prevDay = new Date(newSchemaForm.valid_from)
        prevDay.setDate(prevDay.getDate() - 1)
        await updateMotivationSchema(supabase, activeSchema.id, {
          valid_to: prevDay.toISOString().slice(0, 10),
        })
      }

      const posDefaults = getDefaultConfig(pos?.company?.name)
      await createMotivationSchema(supabase, {
        position_id: positionId,
        name: newSchemaForm.name,
        base_salary: newSchemaForm.base_salary,
        valid_from: newSchemaForm.valid_from,
        config: activeSchema?.config || posDefaults as any,
      })
      const posData = await getPositions(supabase)
      setPositions(posData)
      setShowNewSchema(null)
      setNewSchemaForm({ name: '', base_salary: 30000, valid_from: new Date().toISOString().slice(0, 10) })
      // Re-expand and load new schema
      const updatedPos = posData.find((p: any) => p.id === positionId)
      const newActive = getActiveSchema(updatedPos)
      if (newActive) startEdit(newActive)
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  }

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={currentUser?.role || 'admin'} userName={currentUser?.full_name || ''} companyName={currentUser?.company?.name || ''} />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-7 h-7 text-blue-400" />
              <div>
                <h1 className="text-2xl font-heading font-bold text-white">Должности</h1>
                <p className="text-xs text-white/40">Оклад, мотивация, KPI — всё в одном месте</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Отмена' : 'Новая должность'}
            </button>
          </div>

          {/* Create position form */}
          {showForm && (
            <form onSubmit={handleCreatePosition} className="glass rounded-2xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Название</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none"
                    placeholder="Менеджер отдела продаж" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Компания</label>
                  <select required value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none">
                    <option value="">Выберите</option>
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving === 'new-pos'}
                className="bg-blue-400 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                {saving === 'new-pos' ? 'Создаём...' : 'Создать должность'}
              </button>
            </form>
          )}

          {/* Positions list */}
          {positions.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Briefcase className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">Нет должностей</p>
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map((pos: any) => {
                const isExpanded = expandedPos === pos.id
                const activeSchema = getActiveSchema(pos)
                const allSchemas = getAllSchemas(pos)
                const edit = activeSchema ? editConfigs[activeSchema.id] : null
                const posDefaults = getDefaultConfig(pos.company?.name)
                const cfg: MotivationConfig = edit?.config || (activeSchema ? { ...posDefaults, ...activeSchema.config } : posDefaults)
                const isBonda = isBondaCompany(pos.company?.name)

                return (
                  <div key={pos.id} className="glass rounded-2xl overflow-hidden">
                    {/* Position header */}
                    <button
                      onClick={() => expandPosition(pos.id)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-white font-semibold">{pos.name}</p>
                          <p className="text-xs text-white/40">{pos.company?.name || '—'}</p>
                        </div>
                        {activeSchema && (
                          <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                            Оклад: {formatNum(activeSchema.base_salary)} ₽
                          </span>
                        )}
                        {!activeSchema && (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                            Нет схемы
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {activeSchema && (
                          <div className="flex gap-2">
                            {isBonda ? (
                              <>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">ФД {((activeSchema.config?.fd_percent_high || 0.15) * 100).toFixed(1)}%</span>
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">KPI {activeSchema.config?.kpi_max_amount || 10000}₽</span>
                                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Разовые {((activeSchema.config?.one_time_service_percent || 0.10) * 100)}%</span>
                              </>
                            ) : (
                              <>
                                {activeSchema.config?.kpi_quality?.enabled && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">KPI кач.</span>}
                                {activeSchema.config?.kpi_quantity?.enabled && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">KPI кол.</span>}
                                {activeSchema.config?.margin_bonus?.enabled && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">Маржа</span>}
                              </>
                            )}
                          </div>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-white/30" /> : <ChevronDown className="w-5 h-5 text-white/30" />}
                      </div>
                    </button>

                    {/* Expanded: schema editor */}
                    {isExpanded && (
                      <div className="px-6 pb-6 border-t border-white/5 pt-5">
                        {!activeSchema ? (
                          /* No schema — offer to create */
                          <div className="text-center py-6">
                            <p className="text-white/40 mb-4">У этой должности нет схемы мотивации</p>
                            <button onClick={() => setShowNewSchema(pos.id)}
                              className="bg-blue-400 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                              <Plus className="w-4 h-4 inline mr-1" /> Создать схему
                            </button>
                          </div>
                        ) : edit ? (
                          <>
                            {/* Active schema editor */}
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-xs text-white/30 uppercase tracking-wider">Актуальная схема</p>
                              <button onClick={() => setShowNewSchema(showNewSchema === pos.id ? null : pos.id)}
                                className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {showNewSchema === pos.id ? 'Отмена' : 'Новая версия (смена оклада)'}
                              </button>
                            </div>

                            {/* New schema form */}
                            {showNewSchema === pos.id && (
                              <div className="glass rounded-xl p-4 mb-5 border border-blue-500/20">
                                <p className="text-sm text-blue-400 font-medium mb-3">Новая версия схемы</p>
                                <p className="text-xs text-white/40 mb-3">
                                  Текущая схема закроется, новая начнёт действовать с указанной даты.
                                  KPI-настройки скопируются из текущей схемы.
                                </p>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                  <div>
                                    <label className="block text-[10px] text-white/40 mb-1">Название</label>
                                    <input type="text" value={newSchemaForm.name}
                                      onChange={e => setNewSchemaForm(p => ({ ...p, name: e.target.value }))}
                                      placeholder="Стандарт Q2 2026"
                                      className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-white/40 mb-1">Новый оклад ₽</label>
                                    <input type="number" value={newSchemaForm.base_salary}
                                      onChange={e => setNewSchemaForm(p => ({ ...p, base_salary: Number(e.target.value) }))}
                                      className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-white/40 mb-1">Действует с</label>
                                    <input type="date" value={newSchemaForm.valid_from}
                                      onChange={e => setNewSchemaForm(p => ({ ...p, valid_from: e.target.value }))}
                                      className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none" />
                                  </div>
                                </div>
                                <button onClick={() => handleCreateSchema(pos.id)}
                                  disabled={saving === 'new-schema' || !newSchemaForm.name}
                                  className="bg-blue-400 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50">
                                  {saving === 'new-schema' ? 'Создаю...' : 'Создать'}
                                </button>
                              </div>
                            )}

                            {/* Base info */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Название схемы</label>
                                <input type="text" value={edit.name}
                                  onChange={e => setEditConfigs(prev => ({ ...prev, [activeSchema.id]: { ...prev[activeSchema.id], name: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Оклад ₽</label>
                                <input type="number" value={edit.baseSalary}
                                  onChange={e => setEditConfigs(prev => ({ ...prev, [activeSchema.id]: { ...prev[activeSchema.id], baseSalary: Number(e.target.value) } }))}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-white/40 mb-1">Действует с</label>
                                <input type="text" value={edit.validFrom} disabled
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/30 outline-none" />
                              </div>
                            </div>

                            {/* План встреч (общий) */}
                            <div className="mb-6">
                              <label className="block text-xs text-white/40 mb-1">План встреч (на месяц)</label>
                              <input type="number" value={cfg.meetings_plan}
                                onChange={e => updateConfig(activeSchema.id, 'meetings_plan', Number(e.target.value))}
                                className="w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                            </div>

                            {isBonda ? (
                              <>
                                {/* === БОНДА settings === */}
                                <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Пуш-бонус ФинДир</p>
                                <div className="glass rounded-xl p-4 mb-4">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Порог повышения ставки (шт. ФД)</label>
                                      <input type="number" value={cfg.fd_threshold ?? 4}
                                        onChange={e => updateConfig(activeSchema.id, 'fd_threshold', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">% ФД до порога</label>
                                      <input type="number" step="0.001" value={cfg.fd_percent_low ?? 0.075}
                                        onChange={e => updateConfig(activeSchema.id, 'fd_percent_low', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                      <p className="text-[10px] text-white/20 mt-0.5">0.075 = 7.5%</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">% ФД после порога</label>
                                      <input type="number" step="0.001" value={cfg.fd_percent_high ?? 0.15}
                                        onChange={e => updateConfig(activeSchema.id, 'fd_percent_high', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                      <p className="text-[10px] text-white/20 mt-0.5">0.15 = 15%</p>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Bonda BI проценты по периодам</p>
                                <div className="glass rounded-xl p-4 mb-4">
                                  <div className="grid grid-cols-4 gap-4">
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Месяц</label>
                                      <input type="number" step="0.1" value={cfg.bi_percents?.month ?? 0.5}
                                        onChange={e => updateConfig(activeSchema.id, 'bi_percents.month', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Квартал</label>
                                      <input type="number" step="0.1" value={cfg.bi_percents?.quarter ?? 1.0}
                                        onChange={e => updateConfig(activeSchema.id, 'bi_percents.quarter', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Полгода</label>
                                      <input type="number" step="0.1" value={cfg.bi_percents?.half_year ?? 1.5}
                                        onChange={e => updateConfig(activeSchema.id, 'bi_percents.half_year', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Год</label>
                                      <input type="number" step="0.1" value={cfg.bi_percents?.year ?? 2.0}
                                        onChange={e => updateConfig(activeSchema.id, 'bi_percents.year', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                  </div>
                                </div>

                                <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Разовые услуги</p>
                                <div className="glass rounded-xl p-4 mb-4">
                                  <div>
                                    <label className="block text-xs text-white/40 mb-1">% за разовые услуги</label>
                                    <input type="number" step="0.01" value={cfg.one_time_service_percent ?? 0.10}
                                      onChange={e => updateConfig(activeSchema.id, 'one_time_service_percent', Number(e.target.value))}
                                      className="w-48 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    <p className="text-[10px] text-white/20 mt-0.5">0.10 = 10%</p>
                                  </div>
                                </div>

                                <p className="text-xs text-white/30 uppercase tracking-wider mb-3">KPI</p>
                                <div className="glass rounded-xl p-4 mb-6">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Бонус за KPI ₽</label>
                                      <input type="number" value={cfg.kpi_max_amount ?? 10000}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_max_amount', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Порог записей (менеджер)</label>
                                      <input type="number" value={cfg.kpi_entries_target ?? 12}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_entries_target', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Порог записей (младший)</label>
                                      <input type="number" value={cfg.kpi_entries_target_junior ?? 5}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_entries_target_junior', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                  </div>
                                  <div className="mt-4 flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={cfg.attestation.enabled}
                                        onChange={e => updateConfig(activeSchema.id, 'attestation.enabled', e.target.checked)}
                                        className="sr-only peer" />
                                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-purple-500 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                                    </label>
                                    <span className="text-sm font-medium text-white">Аттестация (галочка руководителя)</span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* === ИННО settings === */}
                                {/* KPI Quality */}
                                <div className="glass rounded-xl p-4 mb-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={cfg.kpi_quality.enabled}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_quality.enabled', e.target.checked)}
                                        className="sr-only peer" />
                                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-emerald-500 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                                    </label>
                                    <span className="text-sm font-medium text-white">KPI качественный</span>
                                    <span className="text-xs text-white/30">(конверсия встреч)</span>
                                  </div>
                                  {cfg.kpi_quality.enabled && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-xs text-white/40 mb-1">Макс. бонус ₽</label>
                                        <input type="number" value={cfg.kpi_quality.max_amount}
                                          onChange={e => updateConfig(activeSchema.id, 'kpi_quality.max_amount', Number(e.target.value))}
                                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-white/40 mb-1">Порог конверсии %</label>
                                        <input type="number" value={cfg.kpi_quality.conversion_threshold}
                                          onChange={e => updateConfig(activeSchema.id, 'kpi_quality.conversion_threshold', Number(e.target.value))}
                                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* KPI Quantity */}
                                <div className="glass rounded-xl p-4 mb-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={cfg.kpi_quantity.enabled}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_quantity.enabled', e.target.checked)}
                                        className="sr-only peer" />
                                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-blue-500 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                                    </label>
                                    <span className="text-sm font-medium text-white">KPI количественный</span>
                                    <span className="text-xs text-white/30">(штуки)</span>
                                  </div>
                                  {cfg.kpi_quantity.enabled && (
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Макс. бонус ₽</label>
                                      <input type="number" value={cfg.kpi_quantity.max_amount}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_quantity.max_amount', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                  )}
                                </div>

                                {/* Margin Bonus */}
                                <div className="glass rounded-xl p-4 mb-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={cfg.margin_bonus.enabled}
                                        onChange={e => updateConfig(activeSchema.id, 'margin_bonus.enabled', e.target.checked)}
                                        className="sr-only peer" />
                                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-orange-500 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                                    </label>
                                    <span className="text-sm font-medium text-white">Маржа с оборудования</span>
                                  </div>
                                  {cfg.margin_bonus.enabled && (
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Процент маржи (0.094 = 9.4%)</label>
                                      <input type="number" step="0.001" value={cfg.margin_bonus.percent}
                                        onChange={e => updateConfig(activeSchema.id, 'margin_bonus.percent', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                  )}
                                </div>

                                {/* Attestation */}
                                <div className="glass rounded-xl p-4 mb-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={cfg.attestation.enabled}
                                        onChange={e => updateConfig(activeSchema.id, 'attestation.enabled', e.target.checked)}
                                        className="sr-only peer" />
                                      <div className="w-9 h-5 bg-white/10 peer-checked:bg-purple-500 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                                    </label>
                                    <span className="text-sm font-medium text-white">Аттестация</span>
                                  </div>
                                  {cfg.attestation.enabled && (
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Бонус за аттестацию ₽</label>
                                      <input type="number" value={cfg.attestation.bonus_amount}
                                        onChange={e => updateConfig(activeSchema.id, 'attestation.bonus_amount', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                  )}
                                </div>

                                {/* Push-bonus percents */}
                                <div className="glass rounded-xl p-4 mb-4">
                                  <p className="text-sm font-medium text-white mb-3">Пуш-бонус (% от MRR по периоду подписки)</p>
                                  <div className="grid grid-cols-4 gap-3">
                                    {[
                                      { key: 'month', label: 'Месяц' },
                                      { key: 'quarter', label: 'Квартал' },
                                      { key: 'half_year', label: 'Полгода' },
                                      { key: 'year', label: 'Год' },
                                    ].map(p => (
                                      <div key={p.key}>
                                        <label className="block text-xs text-white/40 mb-1">{p.label}</label>
                                        <input type="number" step="0.01"
                                          value={(cfg.push_bonus_percents as any)?.[p.key] ?? 0}
                                          onChange={e => updateConfig(activeSchema.id, `push_bonus_percents.${p.key}`, Number(e.target.value))}
                                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                        <p className="text-[10px] text-white/20 mt-0.5">{Math.round(((cfg.push_bonus_percents as any)?.[p.key] ?? 0) * 100)}%</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Implementation percent */}
                                <div className="glass rounded-xl p-4 mb-4">
                                  <p className="text-sm font-medium text-white mb-3">Услуги по внедрению</p>
                                  <div>
                                    <label className="block text-xs text-white/40 mb-1">Процент от выручки (0.10 = 10%)</label>
                                    <input type="number" step="0.01" value={cfg.implementation_percent ?? 0.10}
                                      onChange={e => updateConfig(activeSchema.id, 'implementation_percent', Number(e.target.value))}
                                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                  </div>
                                </div>

                                {/* Threshold multipliers */}
                                <div className="glass rounded-xl p-4 mb-4">
                                  <p className="text-sm font-medium text-white mb-3">Пороговые множители</p>
                                  <div className="mb-3">
                                    <label className="block text-xs text-white/40 mb-1">Мин. порог начисления (%)</label>
                                    <input type="number" value={cfg.threshold_multipliers?.min_percent ?? 70}
                                      onChange={e => updateConfig(activeSchema.id, 'threshold_multipliers.min_percent', Number(e.target.value))}
                                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                  </div>
                                  <div className="space-y-2">
                                    {(cfg.threshold_multipliers?.tiers || [
                                      { from: 0, to: 69, multiplier: 0 },
                                      { from: 70, to: 100, multiplier: 1 },
                                      { from: 101, to: 120, multiplier: 1.2 },
                                      { from: 121, to: 999, multiplier: 1.5 },
                                    ]).map((tier: any, idx: number) => (
                                      <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                                        <div className="flex items-center gap-1">
                                          <input type="number" value={tier.from}
                                            onChange={e => {
                                              const tiers = [...(cfg.threshold_multipliers?.tiers || [])]
                                              tiers[idx] = { ...tiers[idx], from: Number(e.target.value) }
                                              updateConfig(activeSchema.id, 'threshold_multipliers.tiers', tiers)
                                            }}
                                            className="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
                                          <span className="text-xs text-white/30">–</span>
                                          <input type="number" value={tier.to}
                                            onChange={e => {
                                              const tiers = [...(cfg.threshold_multipliers?.tiers || [])]
                                              tiers[idx] = { ...tiers[idx], to: Number(e.target.value) }
                                              updateConfig(activeSchema.id, 'threshold_multipliers.tiers', tiers)
                                            }}
                                            className="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
                                          <span className="text-xs text-white/30">%</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-white/30">x</span>
                                          <input type="number" step="0.1" value={tier.multiplier}
                                            onChange={e => {
                                              const tiers = [...(cfg.threshold_multipliers?.tiers || [])]
                                              tiers[idx] = { ...tiers[idx], multiplier: Number(e.target.value) }
                                              updateConfig(activeSchema.id, 'threshold_multipliers.tiers', tiers)
                                            }}
                                            className="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
                                        </div>
                                        <span className={cn('text-xs font-medium', tier.multiplier === 0 ? 'text-red-400' : tier.multiplier >= 1.2 ? 'text-emerald-400' : 'text-white/50')}>
                                          {tier.multiplier === 0 ? 'Без бонуса' : `Множитель ${tier.multiplier}`}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* KPI entries targets */}
                                <div className="glass rounded-xl p-4 mb-6">
                                  <p className="text-sm font-medium text-white mb-3">KPI записи (целевое кол-во)</p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Менеджер (презентации)</label>
                                      <input type="number" value={cfg.kpi_entries_target ?? 20}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_entries_target', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-white/40 mb-1">Младший (встречи)</label>
                                      <input type="number" value={cfg.kpi_entries_target_junior ?? 5}
                                        onChange={e => updateConfig(activeSchema.id, 'kpi_entries_target_junior', Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none" />
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Save */}
                            <div className="flex items-center justify-between">
                              <button onClick={() => saveSchema(activeSchema.id)} disabled={saving === activeSchema.id}
                                className="flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                                {saving === activeSchema.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving === activeSchema.id ? 'Сохраняю...' : 'Сохранить'}
                              </button>
                            </div>

                            {/* Schema history */}
                            {allSchemas.length > 1 && (
                              <div className="mt-6 pt-4 border-t border-white/5">
                                <p className="text-xs text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> История схем
                                </p>
                                <div className="space-y-2">
                                  {allSchemas.map((s: any, idx: number) => (
                                    <div key={s.id} className={cn(
                                      'flex items-center justify-between px-3 py-2 rounded-lg text-xs',
                                      idx === 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/40'
                                    )}>
                                      <div className="flex items-center gap-3">
                                        <span className="font-medium">{s.name}</span>
                                        <span>Оклад: {formatNum(s.base_salary)} ₽</span>
                                      </div>
                                      <span>
                                        {s.valid_from}{s.valid_to ? ` → ${s.valid_to}` : ' → ...'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : null}
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
