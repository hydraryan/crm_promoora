import { Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

  const filteredLeads = leads.filter((lead) => {
    const matchSearch =
      !search ||
      lead.businessName.toLowerCase().includes(search.toLowerCase()) ||
      lead.ownerName.toLowerCase().includes(search.toLowerCase())
    const matchStage = !stageFilter || lead.stage === stageFilter
    const matchAssigned = !assignedFilter || lead.assignedTo._id === assignedFilter
    const matchType = !typeFilter || lead.businessType === typeFilter
    return matchSearch && matchStage && matchAssigned && matchType
  })

  if (loading)
    return (
      <div className="min-h-full bg-[#0a0a0a] px-8 py-7 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#111111] rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    )

  if (error)
    return (
      <div className="min-h-full bg-[#0a0a0a] px-8 py-7 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[#52525b] text-sm">{error}</p>
          <button onClick={() => void fetchData()} className="text-[#6366f1] text-sm hover:text-[#818cf8]" type="button">
            Try again
          </button>
        </div>
      </div>
    )

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
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

      <div className="bg-[#111111] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_120px_100px_80px] gap-4 px-5 py-3 border-b border-[#1a1a1a]">
          {['Business', 'Owner', 'Stage', 'Assigned', 'Last activity'].map((col) => (
            <p key={col} className="text-[11px] font-medium uppercase tracking-wider text-[#3f3f46]">
              {col}
            </p>
          ))}
        </div>

        <div className="divide-y divide-[#161616]">
          {filteredLeads.map((lead) => (
            <div
              key={lead._id}
              className="grid grid-cols-[1fr_140px_120px_100px_80px] gap-4 px-5 py-3 hover:bg-[#161616] transition-colors duration-150 cursor-pointer group"
            >
              <div className="min-w-0">
                <p className="text-[13px] text-[#a1a1aa] group-hover:text-[#fafafa] truncate transition-colors">
                  {lead.businessName}
                </p>
                <p className="text-[11px] text-[#52525b] truncate">{lead.businessType}</p>
              </div>

              <p className="text-[13px] text-[#71717a] truncate self-center">{lead.ownerName}</p>

              <div className="flex items-center gap-1.5 self-center">
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

              <p className="text-[12px] text-[#52525b] self-center">{lead.assignedTo.name}</p>
              <p className="text-[11px] text-[#3f3f46] font-['Geist_Mono'] self-center">
                {formatRelativeTime(lead.lastActivityAt)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
