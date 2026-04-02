import { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'user_created'
  | 'user_deleted'
  | 'user_blocked'
  | 'user_unblocked'
  | 'user_fired'
  | 'user_edited'
  | 'password_reset'
  | 'period_created'
  | 'period_closed'
  | 'plan_updated'
  | 'schema_created'
  | 'schema_updated'

export async function logAudit(
  supabase: SupabaseClient,
  action: AuditAction,
  actorId: string,
  details?: Record<string, unknown>
) {
  try {
    await supabase.from('audit_log').insert({
      action,
      actor_id: actorId,
      details: details || {},
    })
  } catch (err) {
    // Аудит не должен ломать основной флоу
    console.error('Audit log error:', err)
  }
}

export async function getAuditLog(supabase: SupabaseClient, limit = 100) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*, actor:users!actor_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
