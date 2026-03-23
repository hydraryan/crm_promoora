import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { BUSINESS_TYPES, CLIENT_STATUSES, type BusinessType, type Client, type ClientStatus } from '@/utils/clientConstants'

const SERVICES = ['Website', 'HRM', 'CRM', 'UI/UX', 'Other']

interface NewClientModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  convertedFromLeadId?: string
}

export default function NewClientModal({ isOpen, onClose, onCreated, convertedFromLeadId }: NewClientModalProps) {
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

  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [teamMembers, setTeamMembers] = useState<Array<{ _id: string; name: string }>>([])

  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    businessType: '' as BusinessType | '',
    status: 'Onboarding' as ClientStatus,
    assignedTo: userId,
    services: [] as string[],
    website: '',
    address: '',
    contractValue: '',
    onboardingStartedAt: new Date().toISOString().split('T')[0],
    notes: '',
    convertedFromLead: convertedFromLeadId ?? '',
  })

  useEffect(() => {
    if (!isOpen || role !== 'admin') return

    apiFetch<{ members: Array<{ _id: string; name: string }> }>('/team/members')
      .then((data) => setTeamMembers(data.members))
      .catch(() => setTeamMembers([]))
  }, [isOpen, role])

  useEffect(() => {
    if (isOpen) {
      setForm((prev) => ({
        ...prev,
        assignedTo: userId,
        convertedFromLead: convertedFromLeadId ?? '',
      }))
    }
  }, [isOpen, userId, convertedFromLeadId])

  if (!isOpen) return null
  if (role !== 'admin') return null

  function toggleService(service: string) {
    setForm((f) => ({
      ...f,
      services: f.services.includes(service) ? f.services.filter((s) => s !== service) : [...f.services, service],
    }))
  }

  async function handleSubmit() {
    const errors: string[] = []
    if (!form.businessName.trim()) errors.push('Business name is required')
    if (!form.ownerName.trim()) errors.push('Owner name is required')
    if (!form.phone.trim()) errors.push('Phone number is required')
    if (!form.businessType) errors.push('Business type is required')
    if (!form.assignedTo) errors.push('Assigned to is required')
    if (form.services.length === 0) errors.push('At least one service is required')

    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors([])
    setSubmitting(true)
    try {
      await apiFetch<{ client: Client }>('/clients', {
        method: 'POST',
        body: JSON.stringify({
          businessName: form.businessName,
          ownerName: form.ownerName,
          phone: form.phone,
          email: form.email || undefined,
          businessType: form.businessType,
          status: form.status,
          assignedTo: form.assignedTo,
          services: form.services,
          website: form.website || undefined,
          address: form.address || undefined,
          contractValue: form.contractValue ? Number(form.contractValue) : undefined,
          onboardingStartedAt: form.status === 'Onboarding' ? new Date(form.onboardingStartedAt).toISOString() : undefined,
          notes: form.notes || undefined,
          convertedFromLead: form.convertedFromLead || undefined,
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
        status: 'Onboarding',
        assignedTo: userId,
        services: [],
        website: '',
        address: '',
        contractValue: '',
        onboardingStartedAt: new Date().toISOString().split('T')[0],
        notes: '',
        convertedFromLead: convertedFromLeadId ?? '',
      })
    } catch {
      setValidationErrors(['Failed to create client'])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-110 flex-col border-l border-[#1f1f1f] bg-[#111111]">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">Add new client</h2>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Business name *">
            <input
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value as BusinessType }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              <option value="">Select type</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status *">
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClientStatus }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              {CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assigned to *">
            <select
              value={form.assignedTo}
              onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            >
              <option value="">Select assignee</option>
              {teamMembers.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Services *</label>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => toggleService(service)}
                  className={`rounded-xl px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                    form.services.includes(service)
                      ? 'bg-[#6366f1]/15 text-[#6366f1] ring-1 ring-[#6366f1]/30'
                      : 'bg-[#1a1a1a] text-[#52525b] hover:text-[#a1a1aa]'
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          <Field label="Website">
            <input
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          <Field label="Contract value (₹)">
            <input
              type="number"
              value={form.contractValue}
              onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
            />
          </Field>

          {form.status === 'Onboarding' && (
            <Field label="Onboarding started at">
              <input
                type="date"
                value={form.onboardingStartedAt}
                onChange={(e) => setForm((f) => ({ ...f, onboardingStartedAt: e.target.value }))}
                className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
              />
            </Field>
          )}

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

          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13px] text-[#52525b] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Add client'}
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
