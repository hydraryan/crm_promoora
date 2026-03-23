import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '@/utils/apiFetch'
import type { RolePermissions } from '@/utils/settingsConstants'

interface PermissionContextType {
  permissions: RolePermissions | null
  disabledModules: string[]
  isLoading: boolean
  refresh: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextType | null>(null)

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<RolePermissions | null>(null)
  const [disabledModules, setDisabledModules] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch<{
        user: {
          id: string
          name: string
          email: string
          role: string
        }
        permissions: RolePermissions
        disabledModules: string[]
      }>('/auth/me')
      setPermissions(response.permissions ?? null)
      setDisabledModules(response.disabledModules ?? [])
    } catch (error) {
      console.error('Failed to refresh permissions:', error)
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
  }, [refresh])

  return (
    <PermissionContext.Provider value={{ permissions, disabledModules, isLoading, refresh }}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  const ctx = useContext(PermissionContext)
  if (!ctx) {
    throw new Error('usePermissions must be called inside PermissionProvider')
  }
  return ctx
}

export function canView(permissions: RolePermissions | null, module: string): boolean {
  if (!permissions) return false
  const modulePerms = permissions[module as keyof RolePermissions]
  return modulePerms ? modulePerms.view : false
}
