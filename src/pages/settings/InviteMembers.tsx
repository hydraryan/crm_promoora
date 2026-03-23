import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import AddMemberModal from '@/pages/team/AddMemberModal'
import type { Role } from '@/utils/teamConstants'

interface InviteMembersProps {
  role: Role
}

export default function InviteMembers({ role }: InviteMembersProps) {
  const [success, setSuccess] = useState(false)

  if (role !== 'admin') {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0a] px-8 py-7">
        <p className="text-sm text-[#52525b]">Member invites are available to admins only.</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Settings · Workspace</p>
        <h1 className="text-[22px] font-semibold text-[#fafafa]">Invite members</h1>
        <p className="mt-1 text-[13px] text-[#52525b]">Add team members directly or send them an invite link.</p>
      </div>

      {success && (
        <div className="mb-4 flex max-w-md items-center gap-2 rounded-xl border border-[#22c55e]/15 bg-[#22c55e]/8 px-4 py-3">
          <CheckCircle2 size={13} className="shrink-0 text-[#22c55e]" />
          <p className="text-[12px] text-[#a1a1aa]">Member action completed successfully.</p>
        </div>
      )}

      <div className="max-w-md">
        <AddMemberModal
          inline
          onSuccess={() => {
            setSuccess(true)
            window.setTimeout(() => setSuccess(false), 2000)
          }}
        />
      </div>
    </div>
  )
}
