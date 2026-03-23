import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/utils/apiFetch'
import { roleColors, roleLabels, type MemberWorkload, type Role } from '@/utils/teamConstants'

interface WorkloadOverviewProps {
  role: Role
  currentUserId: string
  onOpenMember: (memberId: string) => void
}

export default function WorkloadOverview({ role, currentUserId, onOpenMember }: WorkloadOverviewProps) {
  const [loading, setLoading] = useState(true)
  const [workload, setWorkload] = useState<MemberWorkload[]>([])

  useEffect(() => {
    if (role !== 'admin') {
      setLoading(false)
      return
    }

    let active = true

    async function load() {
      setLoading(true)
      try {
        const response = await apiFetch<{ members: MemberWorkload[] }>('/team/workload')
        if (active) {
          setWorkload(response.members || [])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [role])

  const maxColValues = useMemo(
    () => [
      Math.max(...workload.map((m) => m.leadsAssigned), 1),
      Math.max(...workload.map((m) => m.followupsPending), 1),
      Math.max(...workload.map((m) => m.projectsAssigned), 1),
      Math.max(...workload.map((m) => m.proposalsSent), 1),
    ],
    [workload],
  )

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#111111]" />
        ))}
      </div>
    )

  if (role !== 'admin') {
    return (
      <div className="min-h-full rounded-2xl bg-[#111111] p-6">
        <p className="text-[13px] text-[#71717a]">Workload overview is available for admins only.</p>
        <button onClick={() => onOpenMember(currentUserId)} className="mt-3 rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#222222]">
          Open my profile
        </button>
      </div>
    )
  }

  const sorted = [...workload]
    .filter((item) => item.member.status === 'active')
    .sort((a, b) => b.leadsAssigned + b.followupsPending + b.projectsAssigned - (a.leadsAssigned + a.followupsPending + a.projectsAssigned))

  const totals = {
    leadsAssigned: sorted.reduce((sum, item) => sum + item.leadsAssigned, 0),
    followupsPending: sorted.reduce((sum, item) => sum + item.followupsPending, 0),
    projectsAssigned: sorted.reduce((sum, item) => sum + item.projectsAssigned, 0),
    proposalsSent: sorted.reduce((sum, item) => sum + item.proposalsSent, 0),
  }

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Team</p>
        <h1 className="text-[22px] font-semibold text-[#fafafa]">Workload overview</h1>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-8">
        {[
          { label: 'Total leads active', value: totals.leadsAssigned, color: '#6366f1' },
          { label: 'Follow-ups pending', value: totals.followupsPending, color: '#f59e0b' },
          { label: 'Projects in progress', value: totals.projectsAssigned, color: '#22c55e' },
          { label: 'Proposals sent', value: totals.proposalsSent, color: '#a1a1aa' },
        ].map((stat, idx) => (
          <div key={stat.label} className="flex items-center gap-8">
            {idx > 0 && <div className="h-8 w-px bg-[#1f1f1f]" />}
            <div>
              <p className="font-['Geist_Mono'] text-[22px] font-medium" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="mt-0.5 text-[11px] text-[#52525b]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-1 grid grid-cols-[1fr_120px_120px_130px_120px_120px] gap-4 px-3 py-2">
        {['Member', 'Role', 'Leads', 'Follow-ups', 'Projects', 'Proposals'].map((col) => (
          <p key={col} className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
            {col}
          </p>
        ))}
      </div>

      <div className="space-y-px">
        {sorted.map((item) => (
          <div
            key={item.member._id}
            onClick={() => onOpenMember(item.member._id)}
            className="group grid cursor-pointer grid-cols-[1fr_120px_120px_130px_120px_120px] gap-4 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${roleColors[item.member.role]}20` }}>
                <span className="text-[10px] font-medium" style={{ color: roleColors[item.member.role] }}>
                  {item.member.initials}
                </span>
              </div>
              <p className="truncate text-[13px] text-[#a1a1aa] transition-colors duration-100 group-hover:text-[#fafafa]">{item.member.name}</p>
            </div>

            <div className="self-center">
              <span className="rounded-md px-2 py-0.5 text-[11px]" style={{ color: roleColors[item.member.role], backgroundColor: `${roleColors[item.member.role]}15` }}>
                {roleLabels[item.member.role]}
              </span>
            </div>

            {[
              { value: item.leadsAssigned, color: '#6366f1', max: maxColValues[0] },
              { value: item.followupsPending, color: '#f59e0b', max: maxColValues[1] },
              { value: item.projectsAssigned, color: '#22c55e', max: maxColValues[2] },
              { value: item.proposalsSent, color: '#a1a1aa', max: maxColValues[3] },
            ].map((stat, idx) => (
              <div key={idx} className="flex items-center gap-2 self-center">
                <p className="font-['Geist_Mono'] text-[14px] font-medium" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <div className="h-0.75 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                  <div className="h-full rounded-full" style={{ width: `${Math.min((stat.value / stat.max) * 100, 100)}%`, backgroundColor: stat.color }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {sorted.length === 0 && <p className="py-12 text-center text-sm text-[#3f3f46]">No workload data found.</p>}
    </div>
  )
}
