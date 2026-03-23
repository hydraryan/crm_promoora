export const CRM_MODULES = [
  'leads',
  'clients',
  'projects',
  'followups',
  'proposals',
  'invoicing',
  'team',
  'communication',
  'reports',
  'settings',
] as const

export type CRMModule = (typeof CRM_MODULES)[number]

export const moduleLabels: Record<CRMModule, string> = {
  leads: 'Leads',
  clients: 'Clients',
  projects: 'Projects',
  followups: 'Follow-ups',
  proposals: 'Proposals',
  invoicing: 'Invoicing',
  team: 'Team',
  communication: 'Communication',
  reports: 'Reports',
  settings: 'Settings',
}

export type PermAction = 'view' | 'create' | 'edit' | 'delete'

export const moduleActions: Record<CRMModule, PermAction[]> = {
  leads: ['view', 'create', 'edit', 'delete'],
  clients: ['view', 'create', 'edit', 'delete'],
  projects: ['view', 'create', 'edit', 'delete'],
  followups: ['view', 'create', 'edit', 'delete'],
  proposals: ['view', 'create', 'edit', 'delete'],
  invoicing: ['view', 'create', 'edit', 'delete'],
  team: ['view', 'create', 'edit', 'delete'],
  communication: ['view'],
  reports: ['view'],
  settings: ['view'],
}

export interface RolePermissions {
  [module: string]: {
    view: boolean
    create: boolean
    edit: boolean
    delete: boolean
  }
}

export interface CRMRole {
  _id: string
  key?: string
  name: string
  color: string
  isSystem: boolean
  permissions: RolePermissions
  disabledModules?: string[]
  memberCount: number
  createdAt: string
}

export const SYSTEM_ROLES: Pick<CRMRole, 'name' | 'color' | 'isSystem'>[] = [
  { name: 'Admin', color: '#6366f1', isSystem: true },
  { name: 'BD Intern', color: '#f59e0b', isSystem: true },
  { name: 'Tech Intern', color: '#22c55e', isSystem: true },
  { name: 'Viewer', color: '#52525b', isSystem: true },
]

export function defaultPerms(): RolePermissions {
  return Object.fromEntries(
    CRM_MODULES.map((module) => [module, { view: false, create: false, edit: false, delete: false }]),
  )
}
