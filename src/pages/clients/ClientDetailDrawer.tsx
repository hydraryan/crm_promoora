import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { CLIENT_STATUSES, BUSINESS_TYPES, type BusinessType, type Client, type ClientStatus, statusDot } from '@/utils/clientConstants'

interface ActivityItem {
  _id: string
  actor: { name: string; initials: string }
  type: string
  description: string
  createdAt: string
}

interface ProjectSummary {
  _id: string
  title: string
  status: 'In progress' | 'Under review' | 'Completed' | 'On hold'
  dueDate?: string
}

interface ClientDetailDrawerProps {
  clientId: string | null
  onClose: () => void
  onUpdated: () => void
}

export default function ClientDetailDrawer({ clientId, onClose, onUpdated }: ClientDetailDrawerProps) {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as {
        role?: string
      }
    } catch {
      return {}
    }
  }, [])

  const role = storedUser.role ?? 'viewer'

  const [client, setClient] = useState<Client | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsUnavailable, setProjectsUnavailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{ _id: string; name: string }>>([])

  const [editForm, setEditForm] = useState({
    ownerName: '',
    phone: '',
    email: '',
    businessType: '' as BusinessType | '',
    website: '',
    address: '',
    assignedTo: '',
    contractValue: '',
    notes: '',
  })

  const isOpen = Boolean(clientId)

  useEffect(() => {
    if (!isOpen || !clientId) return

    setLoading(true)
    setProjectsUnavailable(false)

    Promise.all([
      apiFetch<{ client: Client & { projects?: ProjectSummary[] } }>(`/clients/${clientId}`),
      apiFetch<{ activities: ActivityItem[] }>(`/clients/${clientId}/activity`).catch(() => ({ activities: [] })),
      apiFetch<{ projects: ProjectSummary[] }>(`/projects?clientId=${clientId}`).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : ''
        if (message.includes('404')) {
          setProjectsUnavailable(true)
          return { projects: [] }
        }
        return { projects: [] }
      }),
      role === 'admin'
        ? apiFetch<{ members: Array<{ _id: string; name: string }> }>('/team/members').catch(() => ({ members: [] }))
        : Promise.resolve({ members: [] as Array<{ _id: string; name: string }> }),
    ])
      .then(([clientRes, activityRes, projectRes, teamRes]) => {
        setClient(clientRes.client)
        setActivities(activityRes.activities)
        setProjects(projectRes.projects.length > 0 ? projectRes.projects : clientRes.client.projects ?? [])
        setTeamMembers(teamRes.members)
        setEditForm({
          ownerName: clientRes.client.ownerName,
          phone: clientRes.client.phone,
          email: clientRes.client.email ?? '',
          businessType: clientRes.client.businessType,
          website: clientRes.client.website ?? '',
          address: clientRes.client.address ?? '',
          assignedTo: clientRes.client.assignedTo._id,
          contractValue: clientRes.client.contractValue ? String(clientRes.client.contractValue) : '',
          notes: clientRes.client.notes ?? '',
        })
      })
      .finally(() => setLoading(false))
  }, [isOpen, clientId, role])

  if (!isOpen || !clientId) return null

  async function updateStatus(newStatus: ClientStatus) {
    if (!client || role !== 'admin') return

    const updated = await apiFetch<{ client: Client }>(`/clients/${client._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    })

    setClient(updated.client)
    onUpdated()
  }

  async function saveDetails() {
    if (!client || role !== 'admin') return

    setSaving(true)
    try {
      const updated = await apiFetch<{ client: Client }>(`/clients/${client._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ownerName: editForm.ownerName,
          phone: editForm.phone,
          email: editForm.email || undefined,
          businessType: editForm.businessType,
          website: editForm.website || undefined,
          address: editForm.address || undefined,
          assignedTo: editForm.assignedTo,
          contractValue: editForm.contractValue ? Number(editForm.contractValue) : undefined,
          notes: editForm.notes || undefined,
        }),
      })

      setClient(updated.client)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const labelClass = 'mb-0.5 text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]'
  const valueClass = 'text-[13px] text-[#a1a1aa]'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-130 flex-col border-l border-[#1f1f1f] bg-[#111111]">
        {loading || !client ? (
          <div className="space-y-4 px-6 py-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#1a1a1a]" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold text-[#fafafa]">{client.businessName}</h2>
                <div className="flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-2 py-0.5">
                  {statusDot(client.status)}
                  <span className="text-[11px] text-[#71717a]">{client.status}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a]"
              >
                <X size={15} />
              </button>
            </div>

            {role === 'admin' && (
              <div className="flex items-center gap-2 border-b border-[#1f1f1f] px-6 py-3">
                <p className="mr-1 text-[11px] text-[#3f3f46]">Change status:</p>
                {CLIENT_STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(status)}
                    className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors duration-150 ${
                      client.status === status
                        ? 'bg-[#1a1a1a] text-[#a1a1aa]'
                        : 'text-[#3f3f46] hover:bg-[#1a1a1a] hover:text-[#52525b]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-b border-[#1f1f1f] px-6 py-4">
              <div>
                <p className={labelClass}>Owner</p>
                {role === 'admin' ? (
                  <input
                    value={editForm.ownerName}
                    onChange={(e) => setEditForm((f) => ({ ...f, ownerName: e.target.value }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  />
                ) : (
                  <p className={valueClass}>{client.ownerName}</p>
                )}
              </div>

              <div>
                <p className={labelClass}>Phone</p>
                {role === 'admin' ? (
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  />
                ) : (
                  <p className={valueClass}>{client.phone}</p>
                )}
              </div>

              <div>
                <p className={labelClass}>Email</p>
                {role === 'admin' ? (
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  />
                ) : (
                  <p className={valueClass}>{client.email ?? '—'}</p>
                )}
              </div>

              <div>
                <p className={labelClass}>Type</p>
                {role === 'admin' ? (
                  <select
                    value={editForm.businessType}
                    onChange={(e) => setEditForm((f) => ({ ...f, businessType: e.target.value as BusinessType }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className={valueClass}>{client.businessType}</p>
                )}
              </div>

              <div>
                <p className={labelClass}>Website</p>
                {role === 'admin' ? (
                  <input
                    value={editForm.website}
                    onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  />
                ) : (
                  <p className={valueClass}>{client.website ?? '—'}</p>
                )}
              </div>

              <div>
                <p className={labelClass}>Address</p>
                {role === 'admin' ? (
                  <input
                    value={editForm.address}
                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  />
                ) : (
                  <p className={valueClass}>{client.address ?? '—'}</p>
                )}
              </div>

              <div>
                <p className={labelClass}>Assigned to</p>
                {role === 'admin' ? (
                  <select
                    value={editForm.assignedTo}
                    onChange={(e) => setEditForm((f) => ({ ...f, assignedTo: e.target.value }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  >
                    {teamMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className={valueClass}>{client.assignedTo.name}</p>
                )}
              </div>

              <div>
                <p className={labelClass}>Contract</p>
                {role === 'admin' ? (
                  <input
                    type="number"
                    value={editForm.contractValue}
                    onChange={(e) => setEditForm((f) => ({ ...f, contractValue: e.target.value }))}
                    className="w-full rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                  />
                ) : (
                  <p className={valueClass}>{client.contractValue ? `INR ${client.contractValue.toLocaleString('en-IN')}` : '—'}</p>
                )}
              </div>
            </div>

            <div className="border-b border-[#1f1f1f] px-6 py-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Services</p>
              <div className="flex flex-wrap gap-2">
                {client.services.map((service) => (
                  <span key={service} className="rounded-xl bg-[#1a1a1a] px-3 py-1 text-[11px] text-[#71717a]">
                    {service}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-b border-[#1f1f1f] px-6 py-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Notes</p>
              {role === 'admin' ? (
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                />
              ) : (
                <p className="text-[12px] text-[#71717a]">{client.notes ?? '—'}</p>
              )}

              {role === 'admin' && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={saveDetails}
                    disabled={saving}
                    className="rounded-xl bg-[#6366f1] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#4f46e5] disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save details'}
                  </button>
                </div>
              )}
            </div>

            {projectsUnavailable && (
              <div className="border-b border-[#1f1f1f] px-6 py-4">
                <p className="text-sm text-[#52525b]">Endpoint not available yet. Expected: GET /api/projects?clientId=:id</p>
              </div>
            )}

            {projects.length > 0 && (
              <div className="border-b border-[#1f1f1f] px-6 py-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Projects</p>
                <div className="space-y-px">
                  {projects.map((project) => (
                    <div key={project._id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#1a1a1a]">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          project.status === 'In progress'
                            ? 'bg-[#22c55e]'
                            : project.status === 'Completed'
                              ? 'bg-[#6366f1]'
                              : project.status === 'Under review'
                                ? 'bg-[#f59e0b]'
                                : 'bg-[#52525b]'
                        }`}
                      />
                      <p className="flex-1 text-[12px] text-[#a1a1aa]">{project.title}</p>
                      {project.dueDate && (
                        <p className="font-['Geist_Mono'] text-[11px] text-[#3f3f46]">
                          {new Date(project.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Activity</p>
              <div className="space-y-px">
                {activities.map((activity) => (
                  <div key={activity._id} className="flex items-start gap-3 px-2 py-2">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                      <span className="text-[9px] text-[#71717a]">{activity.actor.initials}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-relaxed text-[#71717a]">{activity.description}</p>
                    </div>
                    <p className="shrink-0 font-['Geist_Mono'] text-[10px] text-[#3f3f46]">{formatRelativeTime(activity.createdAt)}</p>
                  </div>
                ))}

                {activities.length === 0 && <p className="text-[12px] text-[#52525b]">No activity yet</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
