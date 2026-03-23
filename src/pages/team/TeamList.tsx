import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, UserPlus } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import AddMemberModal from './AddMemberModal'
import { roleColors, roleLabels, type Role, type TeamMember } from '@/utils/teamConstants'

interface TeamListProps {
  role: Role
  currentUserId: string
  defaultRole?: Role
  titleOverride?: string
  openAddModal?: boolean
  onOpenMember: (memberId: string) => void
}

type MembersResponse = {
  members: TeamMember[]
  total: number
}

export default function TeamList({ role, currentUserId, defaultRole, titleOverride, openAddModal, onOpenMember }: TeamListProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(Boolean(openAddModal))

  const canAdd = role === 'admin'

  async function loadMembers() {
    setLoading(true)
    try {
      const query = new URLSearchParams()
      if (defaultRole) query.set('role', defaultRole)
      const response = await apiFetch<MembersResponse>(`/team/members?${query.toString()}`)
      setMembers(response.members || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [defaultRole])

  useEffect(() => {
    if (openAddModal) {
      setShowAddModal(true)
    }
  }, [openAddModal])

  const visibleMembers = useMemo(() => {
    if (role === 'admin') return members
    return members.map((member) => {
      if (member._id === currentUserId) return member
      return {
        ...member,
        email: '',
        phone: '',
      }
    })
  }, [members, role, currentUserId])

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#111111]" />
        ))}
      </div>
    )

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Team</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            {titleOverride ?? 'All members'}
            <span className="ml-3 font-['Geist_Mono'] text-[14px] font-normal text-[#52525b]">{visibleMembers.length}</span>
          </h1>
        </div>

        {canAdd && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]"
          >
            <UserPlus size={14} />
            Add member
          </button>
        )}
      </div>

      <div
        className={`mb-1 grid gap-4 px-3 py-2 ${
          role === 'admin' ? 'grid-cols-[1fr_140px_160px_120px_80px_32px]' : 'grid-cols-[1fr_140px_32px]'
        }`}
      >
        {(role === 'admin' ? ['Member', 'Role', 'Contact', 'Joined', 'Status', ''] : ['Member', 'Role', '']).map((col) => (
          <p key={col} className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
            {col}
          </p>
        ))}
      </div>

      <div className="space-y-px">
        {visibleMembers.map((member) => (
          <div
            key={member._id}
            onClick={() => onOpenMember(member._id)}
            className={`group grid cursor-pointer gap-4 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a] ${
              role === 'admin' ? 'grid-cols-[1fr_140px_160px_120px_80px_32px]' : 'grid-cols-[1fr_140px_32px]'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${roleColors[member.role]}20` }}>
                <span className="text-[10px] font-medium" style={{ color: roleColors[member.role] }}>
                  {member.initials}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-[#a1a1aa] transition-colors duration-100 group-hover:text-[#fafafa]">{member.name}</p>
                {member.invitePending && <p className="text-[11px] text-[#f59e0b]">Invite pending</p>}
              </div>
            </div>

            <div className="self-center">
              <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ color: roleColors[member.role], backgroundColor: `${roleColors[member.role]}15` }}>
                {roleLabels[member.role]}
              </span>
            </div>

            {role === 'admin' && (
              <div className="min-w-0 self-center">
                <p className="truncate text-[12px] text-[#52525b]">{member.email}</p>
                <p className="text-[11px] text-[#3f3f46]">{member.phone}</p>
              </div>
            )}

            {role === 'admin' && (
              <p className="self-center font-['Geist_Mono'] text-[11px] text-[#3f3f46]">
                {new Date(member.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}

            {role === 'admin' && (
              <div className="flex items-center gap-1.5 self-center">
                <span className={`size-1.5 rounded-full ${member.status === 'active' ? 'bg-[#22c55e]' : 'bg-[#3f3f46]'}`} />
                <span className="text-[11px] capitalize text-[#52525b]">{member.status}</span>
              </div>
            )}

            <ChevronRight size={13} className="self-center text-[#3f3f46] transition-colors duration-100 group-hover:text-[#52525b]" />
          </div>
        ))}
      </div>

      {visibleMembers.length === 0 && <p className="py-12 text-center text-sm text-[#3f3f46]">No members found.</p>}

      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          loadMembers()
        }}
      />
    </div>
  )
}
