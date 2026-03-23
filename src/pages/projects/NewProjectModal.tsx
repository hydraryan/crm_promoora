import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { usePermissions } from '@/context/PermissionContext'
import { PROJECT_STATUSES, SERVICE_TYPES, type Project, type ProjectStatus, type ServiceType } from '@/utils/projectConstants'

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NewProjectModal({ isOpen, onClose, onCreated }: NewProjectModalProps) {
  const { permissions } = usePermissions()
  const canCreateProjects = Boolean(permissions?.projects?.create)

  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [clients, setClients] = useState<Array<{ _id: string; businessName: string }>>([])
  const [teamMembers, setTeamMembers] = useState<Array<{ _id: string; name: string; initials: string; role: string }>>([])
  const [clientSearch, setClientSearch] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    clientId: '',
    serviceType: '' as ServiceType | '',
    status: 'In progress' as ProjectStatus,
    priority: 'medium' as Project['priority'],
    assignedTo: [] as string[],
    startDate: '',
    dueDate: '',
    notes: '',
  })

  useEffect(() => {
    if (!isOpen || !canCreateProjects) return

    Promise.all([
      apiFetch<{ clients: Array<{ _id: string; businessName: string }> }>('/clients').catch(() => ({ clients: [] })),
      apiFetch<{ members: Array<{ _id: string; name: string; initials: string; role: string }> }>('/team/members').catch(() => ({ members: [] })),
    ]).then(([clientRes, memberRes]) => {
      setClients(clientRes.clients)
      setTeamMembers(memberRes.members)
    })
  }, [isOpen, canCreateProjects])

  if (!isOpen) return null
  if (!canCreateProjects) return null

  function toggleAssigned(id: string) {
    setForm((f) => ({
      ...f,
      assignedTo: f.assignedTo.includes(id) ? f.assignedTo.filter((value) => value !== id) : [...f.assignedTo, id],
    }))
  }

  async function handleSubmit() {
    const errors: string[] = []
    if (!form.title.trim()) errors.push('Project title is required')
    if (!form.clientId) errors.push('Client is required')
    if (!form.serviceType) errors.push('Service type is required')
    if (form.assignedTo.length === 0) errors.push('Assign at least one team member')
    if (form.dueDate && form.startDate && new Date(form.dueDate) < new Date(form.startDate)) {
      errors.push('Due date must be after start date')
    }

    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors([])
    setSubmitting(true)

    try {
      await apiFetch<{ project: Project }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          clientId: form.clientId,
          serviceType: form.serviceType,
          status: form.status,
          priority: form.priority,
          assignedTo: form.assignedTo,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
          notes: form.notes || undefined,
        }),
      })

      onCreated()
      onClose()
      setForm({
        title: '',
        description: '',
        clientId: '',
        serviceType: '',
        status: 'In progress',
        priority: 'medium',
        assignedTo: [],
        startDate: '',
        dueDate: '',
        notes: '',
      })
      setClientSearch('')
    } catch {
      setValidationErrors(['Failed to create project'])
    } finally {
      setSubmitting(false)
    }
  }

  const visibleClients = clients.filter((client) => client.businessName.toLowerCase().includes(clientSearch.toLowerCase()))

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-110 flex-col border-l border-[#1f1f1f] bg-[#111111]">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">New project</h2>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a]">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Title *">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Client *">
            <div className="space-y-2">
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search client..."
                className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
              />
              <select
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
              >
                <option value="">Select client</option>
                {visibleClients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.businessName}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Service type *">
            <select
              value={form.serviceType}
              onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value as ServiceType }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              <option value="">Select service type</option>
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status *">
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Priority</label>
            <div className="flex items-center gap-2">
              {(['low', 'medium', 'high'] as const).map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority }))}
                  className={`flex-1 rounded-xl py-1.5 text-[12px] font-medium capitalize transition-colors duration-150 ${
                    form.priority === priority
                      ? priority === 'high'
                        ? 'bg-[#ef4444]/15 text-[#ef4444] ring-1 ring-[#ef4444]/30'
                        : priority === 'medium'
                          ? 'bg-[#f59e0b]/15 text-[#f59e0b] ring-1 ring-[#f59e0b]/30'
                          : 'bg-[#52525b]/20 text-[#a1a1aa] ring-1 ring-[#52525b]/30'
                      : 'bg-[#1a1a1a] text-[#3f3f46] hover:text-[#52525b]'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Assigned to *</label>
            <div className="overflow-hidden rounded-xl bg-[#1a1a1a]">
              {teamMembers.map((member) => (
                <label key={member._id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-100 hover:bg-[#222222]">
                  <input
                    type="checkbox"
                    checked={form.assignedTo.includes(member._id)}
                    onChange={() => toggleAssigned(member._id)}
                    className="accent-[#6366f1]"
                  />
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2a2a2a]">
                    <span className="text-[9px] text-[#71717a]">{member.initials}</span>
                  </div>
                  <p className="text-[13px] text-[#a1a1aa]">{member.name}</p>
                  <p className="ml-auto text-[11px] text-[#3f3f46]">{member.role}</p>
                </label>
              ))}
            </div>
          </div>

          <Field label="Start date">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Due date">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Notes">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#1f1f1f] px-6 py-4">
          {validationErrors.length > 0 && (
            <div className="mr-auto space-y-1">
              {validationErrors.map((error, idx) => (
                <p key={idx} className="text-[11px] text-[#ef4444]">
                  . {error}
                </p>
              ))}
            </div>
          )}

          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create project'}
          </button>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">{label}</label>
      {children}
    </div>
  )
}
