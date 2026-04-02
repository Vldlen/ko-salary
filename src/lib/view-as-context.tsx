'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
interface ViewAsUser {
  id: string
  full_name: string
  company_id: string
  company?: { name: string }
  position?: { name: string }
}

interface ViewAsContextType {
  /** The manager we're viewing as, or null if viewing own data */
  viewAsUser: ViewAsUser | null
  /** Effective user ID to use for data loading */
  effectiveUserId: (ownId: string) => string
  /** Effective company ID */
  effectiveCompanyId: (ownCompanyId: string) => string
  /** Whether admin is currently impersonating */
  isViewingAs: boolean
  /** Select a manager to view as */
  selectManager: (user: ViewAsUser) => void
  /** Reset to own view */
  resetView: () => void
  /** Available managers list */
  managers: ViewAsUser[]
  /** Load managers list (call once from any page) */
  loadManagers: () => Promise<void>
  /** Whether managers have been loaded */
  managersLoaded: boolean
}

const ViewAsContext = createContext<ViewAsContextType | null>(null)

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsUser, setViewAsUser] = useState<ViewAsUser | null>(null)
  const [managers, setManagers] = useState<ViewAsUser[]>([])
  const [managersLoaded, setManagersLoaded] = useState(false)

  const loadManagers = useCallback(async () => {
    if (managersLoaded) return
    try {
      const res = await fetch('/api/admin/managers')
      if (!res.ok) throw new Error('Ошибка загрузки менеджеров')
      const data = await res.json()
      setManagers(data.managers || [])
      setManagersLoaded(true)
    } catch (err) {
      console.error('Failed to load managers:', err)
    }
  }, [managersLoaded])

  const selectManager = useCallback((user: ViewAsUser) => {
    setViewAsUser(user)
  }, [])

  const resetView = useCallback(() => {
    setViewAsUser(null)
  }, [])

  const effectiveUserId = useCallback((ownId: string) => {
    return viewAsUser?.id || ownId
  }, [viewAsUser])

  const effectiveCompanyId = useCallback((ownCompanyId: string) => {
    return viewAsUser?.company_id || ownCompanyId
  }, [viewAsUser])

  return (
    <ViewAsContext.Provider value={{
      viewAsUser,
      effectiveUserId,
      effectiveCompanyId,
      isViewingAs: !!viewAsUser,
      selectManager,
      resetView,
      managers,
      loadManagers,
      managersLoaded,
    }}>
      {children}
    </ViewAsContext.Provider>
  )
}

export function useViewAs() {
  const ctx = useContext(ViewAsContext)
  if (!ctx) throw new Error('useViewAs must be used within ViewAsProvider')
  return ctx
}
