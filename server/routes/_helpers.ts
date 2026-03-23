import { User } from '../models/User.js'
import type { AuthRequest } from '../middleware/auth.js'

export interface AuthContext {
  userId: string
  email: string
  roleName: string
  permissions: Record<string, string[]>
}

export async function getAuthContext(req: AuthRequest): Promise<AuthContext | null> {
  if (!req.user?.userId || !req.user.email) return null

  const dbUser = await User.findById(req.user.userId).populate('roleId')
  if (!dbUser || typeof dbUser.roleId !== 'object' || !('name' in dbUser.roleId)) return null

  const roleDoc = dbUser.roleId as { name?: string; permissions?: Record<string, string[]> }
  const role = roleDoc.name ?? 'viewer'

  return {
    userId: req.user.userId,
    email: req.user.email,
    roleName: role,
    permissions: roleDoc.permissions ?? {},
  }
}

export function isAdmin(roleName: AuthContext['roleName']): boolean {
  return roleName === 'admin'
}

function normalizeAction(action: string): string {
  if (action === 'read') return 'view'
  if (action === 'update') return 'edit'
  return action
}

export function hasModulePermission(auth: AuthContext, module: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean {
  if (isAdmin(auth.roleName)) return true

  const moduleKey = module === 'invoicing' ? 'invoices' : module
  const aliases = module === 'invoicing' ? ['invoicing', 'invoices'] : [moduleKey]

  return aliases.some((key) => {
    const raw = auth.permissions?.[key] ?? []
    return raw.map((entry) => normalizeAction(entry)).includes(action)
  })
}
