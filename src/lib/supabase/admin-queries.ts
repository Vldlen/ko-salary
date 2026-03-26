import { SupabaseClient } from '@supabase/supabase-js'

// ======== Users Management ========

export async function getUsers(supabase: SupabaseClient, companyId?: string) {
  let query = supabase
    .from('users')
    .select('*, company:companies(name), position:positions(name)')
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
  position_id?: string
  is_active?: boolean
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
    .select('*, company:companies(name), motivation_schemas(*)')
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

// ======== Periods ========

export async function getPeriods(supabase: SupabaseClient, companyId?: string) {
  let query = supabase
    .from('periods')
    .select('*, company:companies(name)')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createPeriod(supabase: SupabaseClient, periodData: {
  company_id: string
  year: number
  month: number
  status?: string
}) {
  const { data, error } = await supabase
    .from('periods')
    .insert({ ...periodData, status: periodData.status || 'draft' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePeriodStatus(supabase: SupabaseClient, periodId: string, status: string) {
  const { data, error } = await supabase
    .from('periods')
    .update({ status })
    .eq('id', periodId)
    .select()
    .single()

  if (error) throw error
  return data
}
