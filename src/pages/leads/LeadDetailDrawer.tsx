import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { API_STAGE_TO_STAGE, PIPELINE_STAGES, STAGE_TO_API_STAGE, stageIcons, type PipelineStage } from '@/utils/leadConstants'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface Lead {
  _id: string
  businessName: string
  ownerName: string
  phone: string
  email?: string
  sourceProvider?: 'google-maps' | 'justdial' | 'indiamart'
  sourcePlaceId?: string
  sourcePlaceUrl?: string
  sourceWebsite?: string
  sourcePhone?: string
  sourceAddress?: string
  sourceCategory?: string
  sourceOpeningHours?: string[]
  businessType: string
  source?: string
  notes?: string
  createdBy: string
  stage: string
  assignedTo: { _id: string; name: string; initials: string }
  createdAt: string
}

interface TeamMember {
  _id: string
  name: string
}

interface ActivityItem {
  _id: string
  actor: { name: string; initials: string }
  type: string
  description: string
  createdAt: string
}

interface LeadDetailDrawerProps {
  leadId: string | null
  onClose: () => void
  onUpdated: () => void
}

export default function LeadDetailDrawer({ leadId, onClose, onUpdated }: LeadDetailDrawerProps) {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as { _id?: string; id?: string; role?: string }
    } catch {
      return {}
    }
  }, [])

  const currentUserId = storedUser._id ?? storedUser.id ?? ''
  const currentRole = storedUser.role ?? 'viewer'

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    businessType: 'other',
    source: '',
    notes: '',
    assignedTo: '',
  })
  const [newFollowupDate, setNewFollowupDate] = useState('')
  const [newFollowupNote, setNewFollowupNote] = useState('')

  useEffect(() => {
    if (!leadId) return
    setLoading(true)
    setError(null)
    setLead(null)
    Promise.all([
      apiFetch<{ lead: Lead }>(`/leads/${leadId}`),
      apiFetch<{ activities: ActivityItem[] }>(`/leads/${leadId}/activity`),
      apiFetch<{ members: TeamMember[] }>('/team/members').catch(() => ({ members: [] })),
    ])
      .then(([leadRes, activityRes, teamRes]) => {
        setLead(leadRes.lead)
        setActivities(activityRes.activities)
        setTeamMembers(teamRes.members)
        setEditForm({
          businessName: leadRes.lead.businessName,
          ownerName: leadRes.lead.ownerName,
          phone: leadRes.lead.phone,
          email: leadRes.lead.email ?? '',
          businessType: leadRes.lead.businessType,
          source: leadRes.lead.source ?? '',
          notes: leadRes.lead.notes ?? '',
          assignedTo: leadRes.lead.assignedTo._id,
        })
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load lead details'
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [leadId])

  if (!leadId) return null

  async function patchLead(payload: Record<string, unknown>) {
    if (!lead) return
    const canEdit = currentRole === 'admin' || lead.createdBy === currentUserId
    if (!canEdit) {
      setError('You can only edit leads created by you.')
      return
    }

    const data = await apiFetch<{ lead: Lead }>(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    setLead(data.lead)
    setEditForm({
      businessName: data.lead.businessName,
      ownerName: data.lead.ownerName,
      phone: data.lead.phone,
      email: data.lead.email ?? '',
      businessType: data.lead.businessType,
      source: data.lead.source ?? '',
      notes: data.lead.notes ?? '',
      assignedTo: data.lead.assignedTo._id,
    })
    onUpdated()
  }

  async function saveLeadDetails() {
    if (!lead) return
    const canEdit = currentRole === 'admin' || lead.createdBy === currentUserId
    if (!canEdit) {
      setError('You can only edit leads created by you.')
      return
    }

    setIsSaving(true)
    try {
      await patchLead({
        businessName: editForm.businessName,
        ownerName: editForm.ownerName,
        phone: editForm.phone,
        email: editForm.email || undefined,
        businessType: editForm.businessType,
        source: editForm.source || undefined,
        notes: editForm.notes || undefined,
        ...(currentRole === 'admin' ? { assignedTo: editForm.assignedTo } : {}),
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function updateStage(stage: PipelineStage) {
    await patchLead({ stage: STAGE_TO_API_STAGE[stage] })
  }

  async function markLost() {
    await patchLead({ stage: 'Lost' })
  }

  async function addFollowup() {
    if (!newFollowupDate) return
    if (!lead) return

    const canEdit = currentRole === 'admin' || lead.createdBy === currentUserId
    if (!canEdit) {
      setError('You can only edit leads created by you.')
      return
    }

    await apiFetch(`/leads/${leadId}/followups`, {
      method: 'POST',
      body: JSON.stringify({
        dueAt: new Date(newFollowupDate).toISOString(),
        note: newFollowupNote || undefined,
      }),
    })

    const activityRes = await apiFetch<{ activities: ActivityItem[] }>(`/leads/${leadId}/activity`)
    setActivities(activityRes.activities)
    setNewFollowupDate('')
    setNewFollowupNote('')
    onUpdated()
  }

  const currentStage = (lead ? API_STAGE_TO_STAGE[lead.stage] : 'Cold') as PipelineStage
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage)
  const canEditLead = Boolean(lead && (currentRole === 'admin' || lead.createdBy === currentUserId))

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-125 flex-col border-l border-[#1f1f1f] bg-[#111111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">Lead details</h2>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]">
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 px-6 py-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#1a1a1a]" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-[#52525b]">{error}</p>
            <button
              onClick={onClose}
              className="mt-3 rounded-xl bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#a1a1aa] hover:bg-[#222222]"
            >
              Close
            </button>
          </div>
        ) : !lead ? (
          <div className="px-6 py-8 text-center text-sm text-[#52525b]">Lead not found.</div>
        ) : (
          <>
            <div className="border-b border-[#1f1f1f] px-6 py-4">
              <div className="flex items-center gap-1">
                {PIPELINE_STAGES.filter((s) => s !== 'Lost').map((stage, i, arr) => {
                  const idx = PIPELINE_STAGES.indexOf(stage)
                  const isActive = idx === currentIndex
                  const isPast = idx < currentIndex
                  return (
                    <div key={stage} className="flex flex-1 items-center gap-1">
                      <button
                        onClick={() => updateStage(stage)}
                        disabled={!canEditLead}
                        className={`h-1 flex-1 rounded-full transition-colors duration-200 ${isActive ? 'bg-[#6366f1]' : isPast ? 'bg-[#6366f1]/30' : 'bg-[#1a1a1a]'}`}
                        title={stage}
                      />
                      {i < arr.length - 1 && <div className="w-px" />}
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-[#52525b]">{currentStage}</span>
                {currentStage !== 'Won' && currentStage !== 'Lost' && (
                  <button
                    onClick={markLost}
                    disabled={!canEditLead}
                    className="text-[11px] text-[#3f3f46] transition-colors hover:text-[#ef4444] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Mark as lost
                  </button>
                )}
              </div>
            </div>

            {!canEditLead && <div className="border-b border-[#1f1f1f] px-6 py-2 text-[11px] text-[#52525b]">Read-only: you can edit only leads created by you.</div>}

            <div className="grid grid-cols-2 gap-4 border-b border-[#1f1f1f] px-6 py-4">
              <Field label="Business">
                <input
                  value={editForm.businessName}
                  disabled={!canEditLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, businessName: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                />
              </Field>
              <Field label="Owner">
                <input
                  value={editForm.ownerName}
                  disabled={!canEditLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, ownerName: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={editForm.phone}
                  disabled={!canEditLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                />
              </Field>
              <Field label="Email">
                <input
                  value={editForm.email}
                  disabled={!canEditLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                />
              </Field>
              <Field label="Type">
                <select
                  value={editForm.businessType}
                  disabled={!canEditLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, businessType: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                >
                  {['restaurant', 'clinic', 'salon', 'shop', 'other'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Source">
                <select
                  value={editForm.source}
                  disabled={!canEditLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                >
                  <option value="">—</option>
                  <option value="walk_in">walk_in</option>
                  <option value="referral">referral</option>
                  <option value="instagram">instagram</option>
                  <option value="cold_call">cold_call</option>
                  <option value="other">other</option>
                </select>
              </Field>
              <Field label="Assigned to">
                <select
                  value={editForm.assignedTo}
                  disabled={currentRole !== 'admin'}
                  onChange={(e) => setEditForm((f) => ({ ...f, assignedTo: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                >
                  {teamMembers.map((member) => (
                    <option key={member._id} value={member._id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Created">
                <p className="text-[12px] text-[#a1a1aa]">
                  {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </Field>
            </div>

            <div className="border-b border-[#1f1f1f] px-6 py-3">
              <Field label="Notes">
                <textarea
                  rows={2}
                  value={editForm.notes}
                  disabled={!canEditLead}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none disabled:opacity-60"
                />
              </Field>
              <div className="mt-2 flex justify-end">
                <button
                  onClick={saveLeadDetails}
                  disabled={!canEditLead || isSaving}
                  className="rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#a1a1aa] transition-colors hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>

            {(lead.sourceProvider || lead.sourcePlaceId || lead.sourceWebsite || lead.sourcePhone || lead.sourceAddress || lead.sourceOpeningHours?.length) && (
              <div className="border-b border-[#1f1f1f] px-6 py-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Scraper source</p>
                <div className="grid grid-cols-2 gap-4">
                  <ReadOnlyField label="Provider" value={lead.sourceProvider ?? '—'} />
                  <ReadOnlyField label="Place ID" value={lead.sourcePlaceId ?? '—'} />
                  <ReadOnlyField label="Phone" value={lead.sourcePhone ?? lead.phone ?? '—'} />
                  <ReadOnlyField label="Website" value={lead.sourceWebsite ?? '—'} />
                  <ReadOnlyField label="Address" value={lead.sourceAddress ?? '—'} />
                  <ReadOnlyField label="Category" value={lead.sourceCategory ?? '—'} />
                  <ReadOnlyField label="Maps URL" value={lead.sourcePlaceUrl ?? '—'} />
                  <ReadOnlyField label="Opening hours" value={lead.sourceOpeningHours?.length ? lead.sourceOpeningHours.join(' • ') : '—'} />
                </div>
              </div>
            )}

            <div className="border-b border-[#1f1f1f] px-6 py-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Schedule follow-up</p>
              <div className="flex items-end gap-2">
                <input
                  type="datetime-local"
                  value={newFollowupDate}
                  onChange={(e) => setNewFollowupDate(e.target.value)}
                  className="flex-1 rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                />
                <input
                  value={newFollowupNote}
                  onChange={(e) => setNewFollowupNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="flex-1 rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
                />
                <button
                  onClick={addFollowup}
                  disabled={!canEditLead}
                  className="rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] font-medium text-[#6366f1] transition-colors duration-150 hover:bg-[#222222]"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Activity</p>
              <div className="space-y-px">
                {activities.map((act) => {
                  const Icon = stageIcons[currentStage]
                  return (
                    <div key={act._id} className="flex items-start gap-3 px-2 py-2">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                        <span className="text-[9px] text-[#71717a]">{act.actor.initials}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-relaxed text-[#71717a]">{act.description}</p>
                      </div>
                      <Icon size={12} className="mt-1 text-[#3f3f46]" />
                      <p className="shrink-0 font-['Geist_Mono'] text-[10px] text-[#3f3f46]">{formatRelativeTime(act.createdAt)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div className="border-t border-[#1f1f1f] px-6 py-3 text-[12px] text-[#52525b]">{lead?.notes ? `Notes: ${lead.notes}` : 'No notes yet'}</div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]">{label}</p>
      {children}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]">{label}</p>
      <p className="break-words text-[12px] text-[#a1a1aa]">{value}</p>
    </div>
  )
}
