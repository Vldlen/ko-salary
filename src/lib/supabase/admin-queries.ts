import { SupabaseClient } from '@supabase/supabase-js'

// ======== Users Management ========

export async function getUsers(supabase: SupabaseClient, companyId?: string) {
  let query = supabase
    .from('users')
    .select('*, company:companies(name, company_type), position:positions(name)')
    .order('full_name')

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createUserProfile(supabase: SupabaseClient, userData: {
  email: string
  full_name: string
  role: string
  company_id: string
  position_id: string
  password: string
}) {
  // 1. Create auth user via Edge Function or admin API
  // Since we can't call admin.createUser from client, we use signUp
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: { full_name: userData.full_name }
    }
  })

  if (authError) throw authError
  if (!authData.user) throw new Error('Failed to create auth user')

  // 2. Create profile in users table
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      company_id: userData.company_id,
      position_id: userData.position_id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateUserProfile(supabase: SupabaseClient, userId: string, updates: {
  full_name?: string
  role?: string
  company_id?: string | null
  position_id?: string | null
  password_plain?: string
  is_active?: boolean
  fired_at?: string | null
  deleted_at?: string | null
}) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ======== Companies ========

export async function getCompanies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

// ======== Positions ========

export async function getPositions(supabase: SupabaseClient, companyId?: string) {
  let query = supabase
    .from('positions')
    .select('*, company:companies(name, company_type), motivation_schemas(*)')
    .order('name')

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createPosition(supabase: SupabaseClient, posData: {
  name: string
  company_id: string
}) {
  const { data, error } = await supabase
    .from('positions')
    .insert(posData)
    .select()
    .single()

  if (error) throw error
  return data
}

// ======== Motivation Schemas ========

export async function getMotivationSchemas(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('motivation_schemas')
    .select('*, position:positions(name, company:companies(name, company_type))')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createMotivationSchema(supabase: SupabaseClient, schema: {
  position_id: string
  name: string
  base_salary: number
  valid_from: string
  config: Record<string, unknown>
}) {
  const { data, error } = await supabase
    .from('motivation_schemas')
    .insert(schema)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMotivationSchema(supabase: SupabaseClient, id: string, updates: {
  name?: string
  base_salary?: number
  config?: Record<string, unknown>
  valid_to?: string | null
}) {
  const { data, error } = await supabase
    .from('motivation_schemas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ======== Periods ========

export async function getPeriods(supabase: SupabaseClient, companyId?: string) {
  let query = supabase
    .from('periods')
    .select('*, company:companies(name, company_type)')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createPeriodForAll(supabase: SupabaseClient, periodData: {
  year: number
  month: number
  status?: string
}) {
  // Get all companies and create period for each
  const { data: companies } = await supabase.from('companies').select('id')
  if (!companies || companies.length === 0) throw new Error('Нет компаний')

  const rows = companies.map(c => ({
    company_id: c.id,
    year: periodData.year,
    month: periodData.month,
    status: periodData.status || 'draft',
  }))

  const { data, error } = await supabase
    .from('periods')
    .insert(rows)
    .select()

  if (error) throw error
  return data
}

export async function updatePeriodStatusByMonth(supabase: SupabaseClient, year: number, month: number, status: string) {
  const { data, error } = await supabase
    .from('periods')
    .update({ status })
    .eq('year', year)
    .eq('month', month)
    .select()

  if (error) throw error
  return data
}

// ======== Individual Plans ========

export async function getIndividualPlans(supabase: SupabaseClient, periodId: string) {
  const { data, error } = await supabase
    .from('individual_plans')
    .select('*')
    .eq('period_id', periodId)

  if (error) throw error
  return data || []
}

export async function upsertIndividualPlan(supabase: SupabaseClient, plan: {
  user_id: string
  period_id: string
  company_id: string
  revenue_plan?: number | null
  units_plan?: number | null
  mrr_plan?: number | null
  findir_plan?: number | null
}) {
  const { data, error } = await supabase
    .from('individual_plans')
    .upsert(
      { ...plan, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,period_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
