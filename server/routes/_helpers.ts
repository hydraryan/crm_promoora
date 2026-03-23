import { User } from '../models/User.js'
import type { AuthRequest } from '../middleware/auth.js'

export interface AuthContext {
  userId: string
  email: string
  roleName: 'admin' | 'bd_intern' | 'tech_intern' | 'viewer'
}

export async function getAuthContext(req: AuthRequest): Promise<AuthContext | null> {
  if (!req.user?.userId || !req.user.email) return null

  const dbUser = await User.findById(req.user.userId).populate('roleId')
  if (!dbUser || typeof dbUser.roleId !== 'object' || !('name' in dbUser.roleId)) return null

  const role = (dbUser.roleId as { name: 'admin' | 'bd_intern' | 'tech_intern' | 'viewer' }).name

  return {
    userId: req.user.userId,
    email: req.user.email,
    roleName: role,
  }
}

export function isAdmin(roleName: AuthContext['roleName']): boolean {
  return roleName === 'admin'
}
