import { useEffect, useState } from 'react'
import { Check, ChevronRight, Plus, ShieldCheck, Trash2, X, Eye, EyeOff } from 'lucide-react'
import { usePermissions } from '@/context/PermissionContext'
import { apiFetch } from '@/utils/apiFetch'
import {
  CRM_MODULES,
  defaultPerms,
  moduleActions,
  moduleLabels,
  type CRMRole,
  type PermAction,
  type RolePermissions,
} from '@/utils/settingsConstants'
import type { Role } from '@/utils/teamConstants'

interface ManageRolesProps {
  role: Role
}

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#A855F7', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#71717a']

export default function ManageRoles({ role }: ManageRolesProps) {
  const [roles, setRoles] = useState<CRMRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingRole, setEditingRole] = useState<CRMRole | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const permissionCtx = (() => {
    try {
      return usePermissions()
    } catch {
      return null
    }
  })()

  const [builderForm, setBuilderForm] = useState({
    name: '',
    color: '#6366f1',
    permissions: defaultPerms(),
    dailySearchLimit: 5,
    disabledModules: [] as string[],
  })

  async function loadRoles() {
    setLoading(true)
    try {
      const response = await apiFetch<{ roles: CRMRole[] }>('/roles')
      setRoles(response.roles || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role !== 'admin') return
    loadRoles()
  }, [role])

  function openBuilder(nextRole?: CRMRole) {
    if (nextRole) {
      setEditingRole(nextRole)
      setBuilderForm({ 
        name: nextRole.name, 
        color: nextRole.color, 
        permissions: nextRole.permissions,
        dailySearchLimit: nextRole.dailySearchLimit ?? 5,
        disabledModules: nextRole.disabledModules ?? [],
      })
    } else {
      setEditingRole(null)
      setBuilderForm({ 
        name: '', 
        color: '#6366f1', 
        permissions: defaultPerms(),
        dailySearchLimit: 5,
        disabledModules: [],
      })
    }
    setShowBuilder(true)
    setSaveSuccess(false)
    setSaveError(null)
  }

  function closeBuilder() {
    setShowBuilder(false)
    setEditingRole(null)
  }

  async function handleSaveRole() {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      if (editingRole) {
        const updated = await apiFetch<{ role: CRMRole }>(`/roles/${editingRole._id}`, {
          method: 'PATCH',
          body: JSON.stringify(builderForm),
        })
        setRoles((prev) => prev.map((roleRow) => (roleRow._id === editingRole._id ? updated.role : roleRow)))
      } else {
        const created = await apiFetch<{ role: CRMRole }>('/roles', {
          method: 'POST',
          body: JSON.stringify(builderForm),
        })
        setRoles((prev) => [...prev, created.role])
      }
      setSaveSuccess(true)
      // Refresh permissions for all users
      if (permissionCtx) {
        await permissionCtx.refresh()
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(roleId: string) {
    if (!window.confirm('Delete this role? Members with this role will need to be reassigned.')) return

    await apiFetch(`/roles/${roleId}`, { method: 'DELETE' })
    setRoles((prev) => prev.filter((roleRow) => roleRow._id !== roleId))
  }

  function updatePerm(module: string, action: PermAction, checked: boolean) {
    setBuilderForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: {
          ...prev.permissions[module],
          [action]: checked,
        },
      },
    }))
  }

  if (role !== 'admin') {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0a] px-8 py-7">
        <p className="text-sm text-[#52525b]">Role management is available to admins only.</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Settings · Workspace</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">Manage roles</h1>
          <p className="mt-1 text-[13px] text-[#52525b]">Control what each role can see and do across the CRM.</p>
        </div>
        <button
          onClick={() => openBuilder()}
          className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]"
        >
          <Plus size={14} />
          New role
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, idx) => (
            <div key={idx} className="h-20 animate-pulse rounded-2xl bg-[#111111]" />
          ))}
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {roles.map((roleRow) => (
            <div key={roleRow._id} className="cursor-pointer rounded-2xl bg-[#111111] p-5 transition-colors duration-150 hover:bg-[#131313]" onClick={() => openBuilder(roleRow)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: roleRow.color }} />
                  <p className="text-[14px] font-medium text-[#fafafa]">{roleRow.name}</p>
                  {roleRow.isSystem && <span className="rounded-md bg-[#1a1a1a] px-2 py-0.5 text-[10px] text-[#3f3f46]">System</span>}
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-[12px] text-[#52525b]">
                    <span className="font-['Geist_Mono'] text-[#71717a]">{roleRow.memberCount}</span> member{roleRow.memberCount !== 1 ? 's' : ''}
                  </p>
                  {!roleRow.isSystem && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDelete(roleRow._id)
                      }}
                      className="p-1 text-[#3f3f46] transition-colors hover:text-[#ef4444]"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <ChevronRight size={13} className="text-[#3f3f46]" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {CRM_MODULES.filter((mod) => roleRow.permissions[mod]?.view).map((mod) => (
                  <span key={mod} className="rounded-md bg-[#1a1a1a] px-2 py-0.5 text-[10px] text-[#52525b]">
                    {moduleLabels[mod]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={closeBuilder} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-130 flex-col overflow-hidden border-l border-[#1f1f1f] bg-[#111111]">
            <div className="shrink-0 border-b border-[#1f1f1f] px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-[#fafafa]">{editingRole ? `Edit: ${editingRole.name}` : 'New role'}</h2>
                <button onClick={closeBuilder} className="flex h-7 w-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a]">
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Role name *</label>
                <input
                  value={builderForm.name}
                  onChange={(event) => setBuilderForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. Sales Manager"
                  disabled={editingRole?.isSystem}
                  className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] placeholder:text-[#3f3f46] outline-none focus:ring-1 focus:ring-[#6366f1] disabled:opacity-40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Color tag</label>
                <div className="flex flex-wrap items-center gap-2">
                  {PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setBuilderForm((prev) => ({ ...prev, color }))}
                      className={`h-7 w-7 rounded-full transition-all duration-150 ${builderForm.color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#111111]' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-[#3f3f46]">Preview:</span>
                  <span className="rounded-lg px-2.5 py-1 text-[11px] font-medium" style={{ color: builderForm.color, backgroundColor: `${builderForm.color}18` }}>
                    {builderForm.name || 'Role name'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Daily Search Limit</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={builderForm.dailySearchLimit}
                    onChange={(event) => setBuilderForm((prev) => ({ ...prev, dailySearchLimit: Math.max(0, Number(event.target.value) || 0) }))}
                    className="w-24 rounded-xl bg-[#1a1a1a] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  />
                  <p className="text-[12px] text-[#52525b]">Max Prospector searches per user per day</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Permissions</label>

                <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 px-3 py-2">
                  <p className="text-[10px] text-[#3f3f46]">Module</p>
                  {(['view', 'create', 'edit', 'delete'] as PermAction[]).map((action) => (
                    <p key={action} className="text-center text-[10px] capitalize text-[#3f3f46]">
                      {action}
                    </p>
                  ))}
                </div>

                <div className="overflow-hidden rounded-xl bg-[#1a1a1a]">
                  {CRM_MODULES.map((module, idx) => {
                    const actions = moduleActions[module]
                    const perms = builderForm.permissions[module] ?? { view: false, create: false, edit: false, delete: false }
                    return (
                      <div key={module} className={`grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 px-3 py-2.5 ${idx < CRM_MODULES.length - 1 ? 'border-b border-[#222]' : ''}`}>
                        <p className="self-center text-[13px] text-[#a1a1aa]">{moduleLabels[module]}</p>
                        {(['view', 'create', 'edit', 'delete'] as PermAction[]).map((action) => {
                          const isAllowed = actions.includes(action)
                          return (
                            <div key={action} className="flex items-center justify-center">
                              <button
                                disabled={!isAllowed}
                                onClick={() => updatePerm(module, action, !perms[action])}
                                className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                                  !isAllowed
                                    ? 'cursor-not-allowed border-[#2a2a2a] bg-transparent opacity-30'
                                    : perms[action]
                                      ? 'border-[#6366f1] bg-[#6366f1] text-white'
                                      : 'border-[#3f3f46] text-transparent hover:border-[#52525b]'
                                }`}
                              >
                                <Check size={11} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() =>
                      setBuilderForm((prev) => ({
                        ...prev,
                        permissions: Object.fromEntries(
                          CRM_MODULES.map((module) => [
                            module,
                            {
                              view: true,
                              create: moduleActions[module].includes('create'),
                              edit: moduleActions[module].includes('edit'),
                              delete: moduleActions[module].includes('delete'),
                            },
                          ]),
                        ) as RolePermissions,
                      }))
                    }
                    className="text-[11px] text-[#6366f1] transition-colors hover:text-[#818cf8]"
                  >
                    Grant all
                  </button>
                  <span className="text-[#2a2a2a]">·</span>
                  <button
                    onClick={() =>
                      setBuilderForm((prev) => ({
                        ...prev,
                        permissions: Object.fromEntries(
                          CRM_MODULES.map((module) => [
                            module,
                            { view: false, create: false, edit: false, delete: false },
                          ]),
                        ) as RolePermissions,
                      }))
                    }
                    className="text-[11px] text-[#3f3f46] transition-colors hover:text-[#52525b]"
                  >
                    Revoke all
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Sidebar visibility</label>
                <p className="text-[12px] text-[#52525b]">Hide modules from sidebar even if users have permission</p>

                <div className="mt-3 space-y-2 rounded-xl bg-[#1a1a1a] p-3">
                  {CRM_MODULES.map((module) => {
                    const isDisabled = builderForm.disabledModules.includes(module)
                    return (
                      <button
                        key={module}
                        onClick={() => {
                          setBuilderForm((prev) => ({
                            ...prev,
                            disabledModules: isDisabled
                              ? prev.disabledModules.filter((m) => m !== module)
                              : [...prev.disabledModules, module],
                          }))
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[#222]"
                      >
                        <span className="text-[13px] text-[#a1a1aa]">{moduleLabels[module]}</span>
                        {isDisabled ? (
                          <EyeOff size={14} className="text-[#ef4444]" />
                        ) : (
                          <Eye size={14} className="text-[#52525b]" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {editingRole?.isSystem && (
                <div className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-4 py-3">
                  <ShieldCheck size={13} className="shrink-0 text-[#3f3f46]" />
                  <p className="text-[12px] text-[#52525b]">System roles cannot be renamed or deleted, but their permissions can be adjusted.</p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-[#1f1f1f] px-6 py-4">
              <div>
                {saveSuccess && <p className="text-[12px] text-[#22c55e]">Saved successfully.</p>}
                {saveError && <p className="text-[12px] text-[#ef4444]">{saveError}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={closeBuilder} className="rounded-xl px-4 py-2 text-[13px] text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]">
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={saving || !builderForm.name.trim()}
                  className="rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#4f46e5] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingRole ? 'Save changes' : 'Create role'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
