import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { roleColors, roleLabels, type Role, type TeamMember } from '@/utils/teamConstants'

interface ProfileSettingsProps {
  role: Role
}

export default function ProfileSettings({ role }: ProfileSettingsProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', status: 'active' as 'active' | 'inactive' })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (role !== 'admin') return

    let active = true
    apiFetch<{ members: TeamMember[] }>('/team/members')
      .then((response) => {
        if (!active) return
        setMembers(response.members ?? [])
        if ((response.members ?? []).length > 0) {
          setSelectedId(response.members[0]._id)
        }
      })
      .catch((error: Error) => {
        if (active) setSaveError(error.message || 'Failed to load members')
      })

    return () => {
      active = false
    }
  }, [role])

  useEffect(() => {
    if (!selectedId) return
    const member = members.find((row) => row._id === selectedId)
    if (!member) return

    setSelectedMember(member)
    setForm({ name: member.name, email: member.email, phone: member.phone, status: member.status })
    setSaveSuccess(false)
    setSaveError(null)
  }, [selectedId, members])

  async function handleSave() {
    if (!selectedMember) return

    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      const response = await apiFetch<{ member: TeamMember }>(`/team/members/${selectedMember._id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      })

      setMembers((prev) => prev.map((member) => (member._id === response.member._id ? response.member : member)))
      setSaveSuccess(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save profile changes')
    } finally {
      setSaving(false)
    }
  }

  if (role !== 'admin') {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0a] px-8 py-7">
        <p className="text-sm text-[#52525b]">Profile settings are available to admins only.</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Settings · Account</p>
        <h1 className="text-[22px] font-semibold text-[#fafafa]">Profile</h1>
        <p className="mt-1 text-[13px] text-[#52525b]">Edit team member profiles and account details.</p>
      </div>

      <div className="mb-6 rounded-2xl bg-[#111111] p-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Select member</p>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => (
            <button
              key={member._id}
              onClick={() => setSelectedId(member._id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] transition-colors duration-150 ${
                selectedId === member._id ? 'bg-[#6366f1]/15 text-[#6366f1] ring-1 ring-[#6366f1]/30' : 'bg-[#1a1a1a] text-[#52525b] hover:text-[#a1a1aa]'
              }`}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: `${roleColors[member.role]}20` }}>
                <span className="text-[8px]" style={{ color: roleColors[member.role] }}>
                  {member.initials}
                </span>
              </div>
              {member.name}
            </button>
          ))}
        </div>
      </div>

      {selectedMember && (
        <div className="max-w-lg space-y-5 rounded-2xl bg-[#111111] p-5">
          <div className="flex items-center gap-4 border-b border-[#1f1f1f] pb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${roleColors[selectedMember.role]}20` }}>
              <span className="text-[18px] font-semibold" style={{ color: roleColors[selectedMember.role] }}>
                {selectedMember.initials}
              </span>
            </div>
            <div>
              <p className="text-[15px] font-medium text-[#fafafa]">{selectedMember.name}</p>
              <p className="mt-0.5 text-[12px] text-[#52525b]">
                Member since {new Date(selectedMember.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Full name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Role</label>
            <div className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
              <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ color: roleColors[selectedMember.role], backgroundColor: `${roleColors[selectedMember.role]}15` }}>
                {roleLabels[selectedMember.role]}
              </span>
              <p className="text-[12px] text-[#3f3f46]">· To change role, use Manage roles</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#1a1a1a] px-3 py-3">
            <div>
              <p className="text-[13px] text-[#a1a1aa]">Account status</p>
              <p className="mt-0.5 text-[11px] text-[#52525b]">Inactive members cannot log in</p>
            </div>
            <button
              onClick={() => setForm((prev) => ({ ...prev, status: prev.status === 'active' ? 'inactive' : 'active' }))}
              className={`relative h-5 w-10 rounded-full transition-colors duration-200 ${form.status === 'active' ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]'}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${form.status === 'active' ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {saveSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-[#22c55e]/15 bg-[#22c55e]/8 px-4 py-3">
                <CheckCircle2 size={13} className="shrink-0 text-[#22c55e]" />
                <p className="text-[12px] text-[#a1a1aa]">Changes saved successfully.</p>
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 rounded-xl border border-[#ef4444]/15 bg-[#ef4444]/8 px-4 py-3">
                <AlertCircle size={13} className="shrink-0 text-[#ef4444]" />
                <p className="text-[12px] text-[#a1a1aa]">{saveError}</p>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-[#6366f1] px-5 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
