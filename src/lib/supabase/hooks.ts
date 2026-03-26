'use client'

import { useMemo } from 'react'
import { createClient } from './client'

export function useSupabase() {
  const supabase = useMemo(() => createClient(), [])
  return supabase
}
