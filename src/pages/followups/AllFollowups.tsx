import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Search } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { FOLLOWUP_TYPES, type Followup, type FollowupType } from '@/utils/followupConstants'
import { FollowupRow } from './FollowupRow'
import LeadDetailDrawer from '@/pages/leads/LeadDetailDrawer'
import ClientDetailDrawer from '@/pages/clients/ClientDetailDrawer'

interface AllFollowupsProps {
  defaultView?: 'overdue' | 'today' | 'upcoming'
  defaultType?: FollowupType
  defaultAssignedToMe?: boolean
  titleOverride?: string
}

function startOfDay(value: Date) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

function groupByDate(followups: Followup[]): { label: string; items: Followup[] }[] {
  const groups = new Map<string, Followup[]>()
  const today = startOfDay(new Date())
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  followups.forEach((fu) => {
    const d = new Date(fu.dueAt)
    const day = startOfDay(d)

    let label: string
    if (day.toDateString() === today.toDateString()) label = 'Today'
    else if (day.toDateString() === tomorrow.toDateString()) label = 'Tomorrow'
    else label = day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)?.push(fu)
  })

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items: items.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
  }))
}

export default function AllFollowups({ defaultView, defaultType, defaultAssignedToMe, titleOverride }: AllFollowupsProps) {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as { _id?: string; role?: string }
    } catch {
      return {}
    }
  }, [])

  const role = storedUser.role ?? 'viewer'
  const userId = storedUser._id ?? ''

  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>(defaultType ?? '')
  const [targetFilter, setTargetFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState(defaultAssignedToMe ? userId : '')
  const [showDone, setShowDone] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{ _id: string; name: string; initials: string }>>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  useEffect(() => {
    setTypeFilter(defaultType ?? '')
  }, [defaultType])

  useEffect(() => {
    setAssignedFilter(defaultAssignedToMe ? userId : '')
  }, [defaultAssignedToMe, userId])

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (defaultView) query.set('view', defaultView)
      const data = await apiFetch<{ followups: Followup[]; total: number; overdueCount: number }>(`/followups?${query.toString()}`)

      setFollowups(data.followups)

      if (role === 'admin') {
        const team = await apiFetch<{ members: Array<{ _id: string; name: string; initials?: string }> }>('/team/members').catch(() => ({ members: [] }))
        setTeamMembers(team.members.map((member) => ({ _id: member._id, name: member.name, initials: member.initials ?? member.name.slice(0, 2).toUpperCase() })))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load follow-ups'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [defaultView])

  async function toggleDone(followupId: string, isDone: boolean) {
    try {
      await apiFetch(`/followups/${followupId}/done`, {
        method: 'PATCH',
        body: JSON.stringify({ isDone }),
      })

      setFollowups((prev) => prev.map((followup) => (followup._id === followupId ? { ...followup, isDone, completedAt: isDone ? new Date().toISOString() : undefined } : followup)))
    } catch {
      setError('Failed to update follow-up status')
    }
  }

  function handleViewProfile(followup: Followup) {
    if (followup.targetType === 'lead' && followup.lead?._id) {
      setSelectedLeadId(followup.lead._id)
      return
    }

    if (followup.targetType === 'client' && followup.client?._id) {
      setSelectedClientId(followup.client._id)
    }
  }

  const filteredFollowups = followups.filter((fu) => {
    const target = fu.targetType === 'lead' ? fu.lead : fu.client
    const matchSearch = !search || target?.businessName.toLowerCase().includes(search.toLowerCase())
    const matchType = !typeFilter || fu.type === typeFilter
    const matchTarget = !targetFilter || fu.targetType === targetFilter
    const matchAssigned = !assignedFilter || fu.assignedTo._id === assignedFilter
    const matchDone = showDone ? true : !fu.isDone
    return matchSearch && matchType && matchTarget && matchAssigned && matchDone
  })

  const sortedFollowups = (() => {
    if (defaultAssignedToMe) {
      return [...filteredFollowups].sort((a, b) => {
        const aRank = a.isDone ? 2 : a.isOverdue ? 0 : 1
        const bRank = b.isDone ? 2 : b.isOverdue ? 0 : 1
        if (aRank !== bRank) return aRank - bRank
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      })
    }

    if (defaultView === 'overdue') {
      return [...filteredFollowups].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    }

    if (defaultView === 'today') {
      return [...filteredFollowups].sort((a, b) => {
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      })
    }

    return [...filteredFollowups].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  })()

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#111111]" />
        ))}
      </div>
    )

  if (error)
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0a] px-8 py-7">
        <div className="space-y-2 text-center">
          <p className="text-sm text-[#52525b]">{error}</p>
          <button onClick={refetch} className="text-sm text-[#6366f1] hover:text-[#818cf8]">
            Try again
          </button>
        </div>
      </div>
    )

  const overdueCount = followups.filter((f) => f.isOverdue && !f.isDone).length
  const todayDone = followups.filter((f) => f.isDone).length
  const todayRemaining = followups.filter((f) => !f.isDone).length
  const typePending = sortedFollowups.filter((f) => !f.isDone).length

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Follow-ups</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            {titleOverride ?? 'All follow-ups'}
            <span className={`ml-3 font-['Geist_Mono'] text-[14px] font-normal ${defaultView === 'overdue' ? 'text-[#ef4444]' : 'text-[#52525b]'}`}>
              {sortedFollowups.length}
            </span>
          </h1>
        </div>
      </div>

      {defaultView === 'overdue' && overdueCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#ef4444]/15 bg-[#ef4444]/8 px-4 py-3">
          <AlertCircle size={13} className="shrink-0 text-[#ef4444]" />
          <p className="text-[12px] text-[#a1a1aa]">
            <span className="font-['Geist_Mono'] text-[#ef4444]">{overdueCount}</span> follow-up{overdueCount > 1 ? 's' : ''} past due - contact these leads before they go cold
          </p>
        </div>
      )}

      {defaultView === 'today' && (
        <div className="mb-6 flex items-center gap-8">
          <div>
            <p className="font-['Geist_Mono'] text-[22px] font-medium text-[#fafafa]">{todayDone}</p>
            <p className="mt-0.5 text-[11px] text-[#52525b]">completed today</p>
          </div>
          <div className="h-8 w-px bg-[#1f1f1f]" />
          <div>
            <p className="font-['Geist_Mono'] text-[22px] font-medium text-[#fafafa]">{todayRemaining}</p>
            <p className="mt-0.5 text-[11px] text-[#52525b]">remaining</p>
          </div>
          <div className="h-8 w-px bg-[#1f1f1f]" />
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] text-[#52525b]">Today's progress</p>
              <p className="font-['Geist_Mono'] text-[11px] text-[#71717a]">{followups.length > 0 ? Math.round((todayDone / followups.length) * 100) : 0}%</p>
            </div>
            <div className="h-0.75 overflow-hidden rounded-full bg-[#1a1a1a]">
              <div className="h-full rounded-full bg-[#6366f1] transition-all duration-700" style={{ width: followups.length > 0 ? `${(todayDone / followups.length) * 100}%` : '0%' }} />
            </div>
          </div>
        </div>
      )}

      {defaultType && (
        <p className="-mt-4 mb-5 text-[12px] text-[#52525b]">
          <span className="font-['Geist_Mono'] text-[#71717a]">{typePending}</span> pending {defaultType === 'Phone call' ? 'phone calls' : defaultType === 'Walk-in' ? 'walk-ins' : 'WhatsApp messages'}
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3f3f46]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business..."
            className="w-full rounded-xl bg-[#111111] py-2 pl-8 pr-3 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>

        {!defaultType && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]">
            <option value="">All types</option>
            {FOLLOWUP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}

        <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]">
          <option value="">Leads + clients</option>
          <option value="lead">Leads only</option>
          <option value="client">Clients only</option>
        </select>

        <button
          onClick={() => setShowDone((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] transition-colors duration-150 ${
            showDone ? 'bg-[#6366f1]/15 text-[#6366f1] ring-1 ring-[#6366f1]/30' : 'bg-[#111111] text-[#52525b] hover:text-[#a1a1aa]'
          }`}
        >
          <CheckCircle2 size={13} />
          Show done
        </button>

        {role === 'admin' && !defaultAssignedToMe && (
          <select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]">
            <option value="">All members</option>
            {teamMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {member.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {defaultView === 'upcoming' ? (
        <>
          {groupByDate(sortedFollowups).map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
                {group.label}
                <span className="ml-2 font-['Geist_Mono'] normal-case text-[#2a2a2a]">{group.items.length}</span>
              </p>
              {group.items.map((fu) => (
                <FollowupRow key={fu._id} fu={fu} onToggleDone={toggleDone} onViewProfile={handleViewProfile} />
              ))}
            </div>
          ))}
        </>
      ) : (
        <div className="space-y-px">
          {sortedFollowups.map((fu) => (
            <FollowupRow key={fu._id} fu={fu} onToggleDone={toggleDone} onViewProfile={handleViewProfile} />
          ))}
        </div>
      )}

      {sortedFollowups.length === 0 && !loading && (
        <div className="py-16 text-center">
          <p className="text-sm text-[#3f3f46]">{defaultView === 'overdue' ? "No overdue follow-ups. You're on track." : 'No follow-ups match your filters'}</p>
        </div>
      )}

      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdated={() => {
          refetch()
        }}
      />

      <ClientDetailDrawer
        clientId={selectedClientId}
        onClose={() => setSelectedClientId(null)}
        onUpdated={() => {
          refetch()
        }}
      />
    </div>
  )
}
