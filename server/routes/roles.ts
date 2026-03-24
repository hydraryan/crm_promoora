import { Router, type Response } from 'express'
import { Types } from 'mongoose'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { Role, type IRole } from '../models/Role.js'
import { User } from '../models/User.js'
import { getAuthContext, isAdmin } from './_helpers.js'

const router = Router()
router.use(authenticateToken)

const CRM_MODULES = ['dashboard', 'leads', 'clients', 'projects', 'followups', 'proposals', 'invoicing', 'team', 'communication', 'reports', 'settings'] as const
const ACTIONS = ['view', 'create', 'edit', 'delete'] as const
const STORAGE_KEY_BY_MODULE: Record<CRMModule, string> = {
  dashboard: 'dashboard',
  leads: 'leads',
  clients: 'clients',
  projects: 'projects',
  followups: 'followups',
  proposals: 'proposals',
  invoicing: 'invoices',
  team: 'team',
  communication: 'communication',
  reports: 'reports',
  settings: 'settings',
}

type CRMModule = (typeof CRM_MODULES)[number]
type PermAction = (typeof ACTIONS)[number]

type RoleMatrix = Record<CRMModule, Record<PermAction, boolean>>

function defaultMatrix(): RoleMatrix {
  return Object.fromEntries(
    CRM_MODULES.map((module) => [module, { view: false, create: false, edit: false, delete: false }]),
  ) as RoleMatrix
}

function normalizeStoredAction(action: string): PermAction | null {
  if (action === 'view' || action === 'read') return 'view'
  if (action === 'create') return 'create'
  if (action === 'edit' || action === 'update') return 'edit'
  if (action === 'delete') return 'delete'
  return null
}

function toMatrix(role: IRole): RoleMatrix {
  const result = defaultMatrix()
  const raw = role.permissions as Record<string, string[]>

  CRM_MODULES.forEach((module) => {
    const storageKey = STORAGE_KEY_BY_MODULE[module]
    const aliases = module === 'invoicing' ? ['invoicing', 'invoices'] : [storageKey]
    const actions = aliases.flatMap((key) => raw?.[key] ?? [])
    actions.forEach((action) => {
      const normalized = normalizeStoredAction(action)
      if (normalized) {
        result[module][normalized] = true
      }
    })
  })

  return result
}

function matrixToStoredPermissions(matrix: RoleMatrix) {
  const permissions = Object.fromEntries(
    CRM_MODULES.map((module) => {
      const actions = ACTIONS.filter((action) => Boolean(matrix[module]?.[action]))
      return [STORAGE_KEY_BY_MODULE[module], actions]
    }),
  )
  return {
    ...permissions,
    invoicing: permissions.invoices ?? [],
  }
}

function slugifyRoleName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getSystemDisplayName(name: string) {
  const map: Record<string, string> = {
    admin: 'Admin',
    bd_intern: 'BD Intern',
    tech_intern: 'Tech Intern',
    viewer: 'Viewer',
  }
  return map[name] ?? name
}

function roleToResponse(role: IRole, memberCount: number) {
  return {
    _id: role._id.toString(),
    key: role.name,
    name: role.isSystemRole ? getSystemDisplayName(role.name) : role.label,
    color: role.color ?? '#6366f1',
    isSystem: role.isSystemRole,
    permissions: toMatrix(role),
    disabledModules: role.disabledModules ?? [],
    memberCount,
    createdAt: role.createdAt,
  }
}

function parseMatrix(input: unknown): RoleMatrix {
  const result = defaultMatrix()
  if (!input || typeof input !== 'object') return result
  const raw = input as Record<string, Record<string, unknown>>

  CRM_MODULES.forEach((module) => {
    const value = raw[module] ?? {}
    ACTIONS.forEach((action) => {
      result[module][action] = Boolean(value[action])
    })
  })

  return result
}

async function requireAdmin(req: AuthRequest, res: Response) {
  const auth = await getAuthContext(req)
  if (!auth) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }
  if (!isAdmin(auth.roleName)) {
    res.status(403).json({ error: 'Admin only action' })
    return null
  }
  return auth
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const roles = await Role.find({}).sort({ createdAt: 1 })
    const counts = await User.aggregate([{ $group: { _id: '$roleId', count: { $sum: 1 } } }])
    const countByRole = new Map<string, number>(counts.map((row) => [String(row._id), Number(row.count)]))

    return res.json({
      roles: roles.map((role) => roleToResponse(role, countByRole.get(role._id.toString()) ?? 0)),
    })
  } catch (error) {
    console.error('Roles list error:', error)
    return res.status(500).json({ error: 'Failed to fetch roles' })
  }
})

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const { name, color, permissions, disabledModules } = req.body as { 
      name?: string
      color?: string
      permissions?: unknown
      disabledModules?: string[]
    }

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Role name is required' })
    }

    const slug = slugifyRoleName(name)
    if (!slug) return res.status(400).json({ error: 'Invalid role name' })

    const existing = await Role.findOne({ name: slug })
    if (existing) return res.status(409).json({ error: 'Role with this name already exists' })

    const created = await Role.create({
      name: slug,
      label: name.trim(),
      color: color?.trim() || '#6366f1',
      isSystemRole: false,
      permissions: matrixToStoredPermissions(parseMatrix(permissions)),
      disabledModules: Array.isArray(disabledModules) ? disabledModules : [],
    })

    return res.status(201).json({ role: roleToResponse(created, 0) })
  } catch (error) {
    console.error('Create role error:', error)
    return res.status(500).json({ error: 'Failed to create role' })
  }
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const roleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ error: 'Invalid role id' })
    }

    const role = await Role.findById(roleId)
    if (!role) return res.status(404).json({ error: 'Role not found' })

    const { name, color, permissions, disabledModules } = req.body as { 
      name?: string
      color?: string
      permissions?: unknown
      disabledModules?: string[]
    }

    if (role.isSystemRole && typeof name === 'string' && name.trim() && name.trim() !== getSystemDisplayName(role.name)) {
      return res.status(403).json({ error: 'System role names cannot be changed' })
    }

    if (!role.isSystemRole && typeof name === 'string' && name.trim()) {
      const slug = slugifyRoleName(name)
      if (!slug) return res.status(400).json({ error: 'Invalid role name' })

      const existing = await Role.findOne({ name: slug, _id: { $ne: role._id } })
      if (existing) return res.status(409).json({ error: 'Role with this name already exists' })

      role.name = slug
      role.label = name.trim()
    }

    if (typeof color === 'string' && color.trim()) {
      role.color = color.trim()
    }

    if (permissions) {
      role.permissions = matrixToStoredPermissions(parseMatrix(permissions)) as IRole['permissions']
    }

    if (Array.isArray(disabledModules)) {
      role.disabledModules = disabledModules
    }

    await role.save()

    const memberCount = await User.countDocuments({ roleId: role._id })
    return res.json({ role: roleToResponse(role, memberCount) })
  } catch (error) {
    console.error('Update role error:', error)
    return res.status(500).json({ error: 'Failed to update role' })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return

    const roleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ error: 'Invalid role id' })
    }

    const role = await Role.findById(roleId)
    if (!role) return res.status(404).json({ error: 'Role not found' })
    if (role.isSystemRole) return res.status(403).json({ error: 'System roles cannot be deleted' })

    const usersWithRole = await User.countDocuments({ roleId: role._id })
    if (usersWithRole > 0) {
      return res.status(400).json({ error: 'Cannot delete role with assigned members' })
    }

    await Role.deleteOne({ _id: role._id })
    return res.json({ success: true })
  } catch (error) {
    console.error('Delete role error:', error)
    return res.status(500).json({ error: 'Failed to delete role' })
  }
})

export default router
