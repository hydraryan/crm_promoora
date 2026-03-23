import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { PIPELINE_STAGES, STAGE_TO_API_STAGE, type PipelineStage } from '@/utils/leadConstants'

interface TeamMember {
  _id: string
  name: string
}

interface NewLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NewLeadModal({ isOpen, onClose, onCreated }: NewLeadModalProps) {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as {
        _id?: string
        id?: string
        role?: string
      }
    } catch {
      return {}
    }
  }, [])

  const userId = storedUser._id ?? storedUser.id ?? ''
  const role = storedUser.role ?? 'viewer'

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    businessType: '',
    stage: 'Cold' as PipelineStage,
    assignedTo: userId,
    source: '',
    nextFollowupAt: '',
    notes: '',
  })

  useEffect(() => {
    if (!isOpen || role !== 'admin') return
    apiFetch<{ members: Array<{ _id: string; name: string }> }>('/team/members')
      .then((data) => setTeamMembers(data.members.map((m) => ({ _id: m._id, name: m.name }))))
      .catch(() => setTeamMembers([]))
  }, [isOpen, role])

  useEffect(() => {
    if (isOpen) {
      setForm((prev) => ({ ...prev, assignedTo: userId }))
    }
  }, [isOpen, userId])

  if (!isOpen) return null

  async function handleSubmit() {
    const errors: string[] = []
    if (!form.businessName.trim()) errors.push('Business name is required')
    if (!form.ownerName.trim()) errors.push('Owner name is required')
    if (!form.phone.trim()) errors.push('Phone number is required')
    if (!form.businessType) errors.push('Business type is required')
    if (!form.assignedTo) errors.push('Assigned to is required')

    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors([])
    setSubmitting(true)
    try {
      await apiFetch('/leads', {
        method: 'POST',
        body: JSON.stringify({
          businessName: form.businessName,
          ownerName: form.ownerName,
          phone: form.phone,
          email: form.email || undefined,
          businessType: form.businessType,
          stage: STAGE_TO_API_STAGE[form.stage],
          assignedTo: role === 'admin' ? form.assignedTo : userId,
          source: form.source || undefined,
          nextFollowupAt: form.nextFollowupAt ? new Date(form.nextFollowupAt).toISOString() : undefined,
          notes: form.notes || undefined,
        }),
      })
      onCreated()
      onClose()
      setForm({
        businessName: '',
        ownerName: '',
        phone: '',
        email: '',
        businessType: '',
        stage: 'Cold',
        assignedTo: userId,
        source: '',
        nextFollowupAt: '',
        notes: '',
      })
    } catch {
      setValidationErrors(['Failed to create lead'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-110 flex-col border-l border-[#1f1f1f] bg-[#111111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">Add new lead</h2>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Business name *">
            <input
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
              placeholder="e.g. Sharma Medicals"
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Owner name *">
            <input
              value={form.ownerName}
              onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Phone *">
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Email">
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Business type *">
            <select
              value={form.businessType}
              onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              <option value="">Select type</option>
              <option value="restaurant">Restaurant</option>
              <option value="clinic">Clinic</option>
              <option value="salon">Salon</option>
              <option value="shop">Shop</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Stage">
            <select
              value={form.stage}
              onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as PipelineStage }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assigned to *">
            <select
              value={form.assignedTo}
              onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
              disabled={role !== 'admin'}
            >
              {role === 'admin' ? (
                <>
                  <option value="">Select assignee</option>
                  {teamMembers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value={userId}>Self</option>
              )}
            </select>
          </Field>

          <Field label="Source">
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              <option value="">Select source</option>
              <option value="walk_in">Walk in</option>
              <option value="referral">Referral</option>
              <option value="instagram">Instagram</option>
              <option value="cold_call">Cold call</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Schedule first follow-up">
            <input
              type="datetime-local"
              value={form.nextFollowupAt}
              onChange={(e) => setForm((f) => ({ ...f, nextFollowupAt: e.target.value }))}
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

        <div className="border-t border-[#1f1f1f] px-6 py-4">
          {validationErrors.length > 0 && (
            <div className="mb-3 space-y-1">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-[11px] text-[#ef4444]">
                  . {e}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-[13px] text-[#52525b] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#a1a1aa]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Add lead'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">{label}</label>
      {children}
    </div>
  )
}
