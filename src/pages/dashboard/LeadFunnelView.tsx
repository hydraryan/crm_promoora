import { Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatePanel } from '@/components/ui/state-panel'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface TeamMember {
  _id: string
  name: string
}

interface TeamMembersResponse {
  members: TeamMember[]
}

interface Lead {
  _id: string
  businessName: string
  ownerName: string
  businessType: 'restaurant' | 'clinic' | 'salon' | 'shop' | 'other'
  stage: 'Cold' | 'Contacted' | 'Meeting' | 'Proposal sent' | 'Negotiation' | 'Won' | 'Lost'
  assignedTo: { _id: string; name: string; initials: string }
  lastActivityAt: string
  createdAt: string
  phone: string
}

interface LeadResponse {
  leads: Lead[]
  total: number
}

export default function LeadFunnelView() {
  const user = useMemo(() => {
    const raw = localStorage.getItem('crm_user') ?? localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as { role?: string }) : {}
  }, [])

  const role = user.role ?? 'viewer'

  const [leads, setLeads] = useState<Lead[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const clearSessionAndReload = () => {
    localStorage.removeItem('crm_access_token')
    localStorage.removeItem('crm_refresh_token')
    localStorage.removeItem('crm_user')
    sessionStorage.removeItem('crm_portal_secure_session')
    window.location.reload()
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const leadsData = await apiFetch<LeadResponse>('/leads?stage=all')
      setLeads(leadsData.leads)

      if (role === 'admin') {
        const members = await apiFetch<TeamMembersResponse>('/team/members')
        setTeamMembers(members.members)
      }
    } catch {
      setError('Failed to load lead funnel data')
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const filteredLeads = useMemo(() => {
    const normalizedSearch = search.toLowerCase()
    return leads.filter((lead) => {
      const matchSearch =
        !normalizedSearch ||
        lead.businessName.toLowerCase().includes(normalizedSearch) ||
        lead.ownerName.toLowerCase().includes(normalizedSearch)
      const matchStage = !stageFilter || lead.stage === stageFilter
      const matchAssigned = !assignedFilter || lead.assignedTo._id === assignedFilter
      const matchType = !typeFilter || lead.businessType === typeFilter
      return matchSearch && matchStage && matchAssigned && matchType
    })
  }, [assignedFilter, leads, search, stageFilter, typeFilter])

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-4 py-6 sm:px-8 sm:py-7">
        <Skeleton className="h-11 w-full" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )

  if (error)
    return (
      <StatePanel
        tone="error"
        title="Unable to load lead funnel"
        message={error}
        actionLabel="Try again"
        onAction={() => void fetchData()}
        secondaryActionLabel={error.toLowerCase().includes('session expired') ? 'Log out' : undefined}
        onSecondaryAction={error.toLowerCase().includes('session expired') ? clearSessionAndReload : undefined}
      />
    )

  return (
    <div className="min-h-full bg-[#0a0a0a] px-4 py-6 sm:px-8 sm:py-7">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 bg-[#111111] rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search size={13} className="text-[#52525b] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="bg-transparent outline-none text-[13px] text-[#a1a1aa] placeholder:text-[#3f3f46] w-full"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="bg-[#111111] text-[#a1a1aa] text-[13px] rounded-xl px-3 py-2 outline-none border-none appearance-none"
        >
          <option value="">All stages</option>
          {['Cold', 'Contacted', 'Meeting', 'Proposal sent', 'Negotiation', 'Won', 'Lost'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {role === 'admin' && (
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="bg-[#111111] text-[#a1a1aa] text-[13px] rounded-xl px-3 py-2 outline-none border-none appearance-none"
          >
            <option value="">All members</option>
            {teamMembers.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#111111] text-[#a1a1aa] text-[13px] rounded-xl px-3 py-2 outline-none border-none appearance-none"
        >
          <option value="">All types</option>
          {['restaurant', 'clinic', 'salon', 'shop', 'other'].map((t) => (
            <option key={t} value={t} className="capitalize">
              {t}
            </option>
          ))}
        </select>

        <p className="text-[11px] text-[#52525b] ml-auto font-['Geist_Mono']">{filteredLeads.length} leads</p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#111111]">
        <div className="hidden grid-cols-[1fr_140px_120px_100px_80px] gap-4 border-b border-[#1a1a1a] px-5 py-3 lg:grid">
          {['Business', 'Owner', 'Stage', 'Assigned', 'Last activity'].map((col) => (
            <p key={col} className="text-[11px] font-medium uppercase tracking-wider text-[#3f3f46]">
              {col}
            </p>
          ))}
        </div>

        <div className="divide-y divide-[#161616]">
          {filteredLeads.map((lead) => (
            <div key={lead._id}>
              <div className="group hidden cursor-pointer grid-cols-[1fr_140px_120px_100px_80px] gap-4 px-5 py-3 transition-colors duration-150 hover:bg-[#161616] lg:grid">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-[#a1a1aa] transition-colors group-hover:text-[#fafafa]">
                    {lead.businessName}
                  </p>
                  <p className="truncate text-[11px] text-[#52525b]">{lead.businessType}</p>
                </div>

                <p className="self-center truncate text-[13px] text-[#71717a]">{lead.ownerName}</p>

                <div className="self-center flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      lead.stage === 'Won'
                        ? 'bg-[#22c55e]'
                        : lead.stage === 'Lost'
                          ? 'bg-[#ef4444]'
                          : lead.stage === 'Negotiation'
                            ? 'bg-[#f59e0b]'
                            : lead.stage === 'Proposal sent'
                              ? 'bg-[#f59e0b] opacity-60'
                              : lead.stage === 'Meeting'
                                ? 'bg-[#6366f1]'
                                : lead.stage === 'Contacted'
                                  ? 'bg-[#6366f1] opacity-60'
                                  : 'bg-[#3f3f46]'
                    }`}
                  />
                  <p className="text-[12px] text-[#71717a]">{lead.stage}</p>
                </div>

                <p className="self-center text-[12px] text-[#52525b]">{lead.assignedTo.name}</p>
                <p className="self-center text-[11px] font-['Geist_Mono'] text-[#3f3f46]">
                  {formatRelativeTime(lead.lastActivityAt)}
                </p>
              </div>

              <div className="cursor-pointer rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-[#161616] lg:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[#a1a1aa]">{lead.businessName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#52525b]">
                      {lead.ownerName} · {lead.businessType}
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] font-['Geist_Mono'] text-[#3f3f46]">
                    {formatRelativeTime(lead.lastActivityAt)}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#71717a]">
                  <span className="rounded-md bg-[#1a1a1a] px-2 py-0.5">{lead.stage}</span>
                  <span className="rounded-md bg-[#1a1a1a] px-2 py-0.5">{lead.assignedTo.name}</span>
                </div>
              </div>
            </div>
          ))}

          {filteredLeads.length === 0 && (
            <p className="px-5 py-8 text-center text-[12px] text-[#52525b]">No leads match your current filters.</p>
          )}
        </div>
      </div>
    </div>
  )
}
