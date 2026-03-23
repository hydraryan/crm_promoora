import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import type { TeamMember } from '@/utils/teamConstants'
import type { CRMRole } from '@/utils/settingsConstants'

interface AddMemberModalProps {
  isOpen?: boolean
  onClose?: () => void
  onSuccess: () => void
  inline?: boolean
}

type AddMode = 'direct' | 'invite'

type DirectForm = {
  name: string
  email: string
  phone: string
  role: string
  password: string
  confirmPassword: string
}

type InviteForm = {
  email: string
  role: string
}

type RoleOption = {
  key: string
  label: string
}

export default function AddMemberModal({ isOpen = false, onClose, onSuccess, inline = false }: AddMemberModalProps) {
  const [addMode, setAddMode] = useState<AddMode>('direct')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null)
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([])

  const [directForm, setDirectForm] = useState<DirectForm>({
    name: '',
    email: '',
    phone: '',
    role: 'bd_intern',
    password: '',
    confirmPassword: '',
  })

  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '',
    role: '',
  })

  async function loadRoleOptions() {
    try {
      const response = await apiFetch<{ roles: CRMRole[] }>('/roles')
      const options = (response.roles ?? [])
        .map((role) => ({
          key: role.key ?? role.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          label: role.name,
        }))
        .filter((role) => role.key !== 'admin')

      setRoleOptions(options)

      const defaultRole = options[0]?.key ?? ''
      setDirectForm((prev) => ({ ...prev, role: prev.role || defaultRole }))
      setInviteForm((prev) => ({ ...prev, role: prev.role || defaultRole }))
    } catch {
      setError('Unable to load roles. Please refresh and try again.')
    }
  }

  useEffect(() => {
    loadRoleOptions()
  }, [])

  const modeTitle = useMemo(() => (addMode === 'direct' ? 'Create a member account directly' : 'Send an invite link to join later'), [addMode])

  if (!inline && !isOpen) return null

  async function handleDirectSubmit() {
    setError(null)

    if (!directForm.role) {
      setError('Please select a role.')
      return
    }

    if (!directForm.name.trim() || !directForm.email.trim() || !directForm.phone.trim() || !directForm.password) {
      setError('Please fill all required fields.')
      return
    }

    if (directForm.password !== directForm.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (directForm.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      await apiFetch<{ member: TeamMember }>('/team/members', {
        method: 'POST',
        body: JSON.stringify({
          name: directForm.name.trim(),
          email: directForm.email.trim(),
          phone: directForm.phone.trim(),
          role: directForm.role,
          password: directForm.password,
        }),
      })
      onSuccess()
      if (!inline) onClose?.()
      setDirectForm((prev) => ({ name: '', email: '', phone: '', role: prev.role, password: '', confirmPassword: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create member')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleInviteSubmit() {
    setError(null)

    if (!inviteForm.role) {
      setError('Please select a role.')
      return
    }

    if (!inviteForm.email.trim()) {
      setError('Email is required.')
      return
    }

    setSubmitting(true)
    try {
      await apiFetch<{ success: boolean; email: string }>('/team/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          role: inviteForm.role,
        }),
      })
      setInviteSentTo(inviteForm.email.trim())
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <>
      <div className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#fafafa]">Add member</h2>
          <p className="mt-0.5 text-[12px] text-[#52525b]">{modeTitle}</p>
        </div>
        {!inline && (
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] transition-colors hover:bg-[#111111] hover:text-[#a1a1aa]">
            <X size={15} />
          </button>
        )}
      </div>

      <div className={inline ? 'px-5 py-5' : 'h-[calc(100%-72px)] overflow-y-auto px-5 py-5'}>
        <div className="mb-6 flex w-fit items-center gap-1 rounded-xl bg-[#1a1a1a] p-1">
          {(['direct', 'invite'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setAddMode(mode)
                setError(null)
              }}
              className={`rounded-lg px-4 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                addMode === mode ? 'bg-[#111111] text-[#fafafa]' : 'text-[#3f3f46] hover:text-[#71717a]'
              }`}
            >
              {mode === 'direct' ? 'Create account' : 'Send invite'}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/8 px-3 py-2 text-[12px] text-[#f87171]">{error}</p>}

        {addMode === 'direct' ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Name</label>
              <input
                value={directForm.name}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
                placeholder="Member full name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Email</label>
              <input
                type="email"
                value={directForm.email}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
                placeholder="name@promoora.in"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Phone</label>
              <input
                value={directForm.phone}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
                placeholder="+91 98xxxxxxxx"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Role</label>
              <select
                value={directForm.role}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, role: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
              >
                {roleOptions.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Password</label>
              <input
                type="password"
                value={directForm.password}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Confirm password</label>
              <input
                type="password"
                value={directForm.confirmPassword}
                onChange={(e) => setDirectForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
                placeholder="Repeat password"
              />
            </div>

            <button
              onClick={handleDirectSubmit}
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create member'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Email</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
                placeholder="name@promoora.in"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-widest text-[#52525b]">Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}
                className="w-full rounded-xl border border-[#1f1f1f] bg-[#111111] px-3 py-2 text-[13px] text-[#e4e4e7] outline-none focus:ring-1 focus:ring-[#6366f1]"
              >
                {roleOptions.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleInviteSubmit}
              disabled={submitting}
              className="w-full rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Sending...' : 'Send invite'}
            </button>

            {inviteSentTo && (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#22c55e]/15 bg-[#22c55e]/8 p-4">
                <CheckCircle2 size={14} className="shrink-0 text-[#22c55e]" />
                <div>
                  <p className="text-[13px] font-medium text-[#fafafa]">Invite sent</p>
                  <p className="mt-0.5 text-[11px] text-[#71717a]">A signup link has been emailed to {inviteSentTo}. It expires in 48 hours.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )

  if (inline) {
    return <div className="rounded-2xl border border-[#1f1f1f] bg-[#111111]">{content}</div>
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55">
      <div className="h-full w-full border-l border-[#1f1f1f] bg-[#0a0a0a] shadow-2xl sm:w-105">
        {content}
      </div>
    </div>
  )
}
