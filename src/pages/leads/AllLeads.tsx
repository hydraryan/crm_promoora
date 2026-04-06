import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { API_STAGE_TO_STAGE, PIPELINE_STAGES, stageIcons, type PipelineStage } from '@/utils/leadConstants'
import { usePermissions } from '@/context/PermissionContext'
import NewLeadModal from './NewLeadModal'
import ImportLeadsModal from './ImportLeadsModal'
import ProspectorModal from './ProspectorModal'
import LeadDetailDrawer from './LeadDetailDrawer'

export interface Lead {
  _id: string
  businessName: string
  ownerName: string
  phone: string
  email?: string
  businessType: string
  stage: string
  assignedTo: {
    _id: string
    name: string
    initials: string
  }
  source?: string
  notes?: string
  createdBy: string
  lastActivityAt: string
  nextFollowupAt?: string
  createdAt: string
}

interface AllLeadsProps {
  defaultStage?: PipelineStage
  defaultAssignedTo?: string
  mineOnly?: boolean
  titleOverride?: string
  openNewLeadModal?: boolean
  openImportModal?: boolean
  openProspectorModal?: boolean
}

export default function AllLeads({
  defaultStage,
  defaultAssignedTo,
  mineOnly,
  titleOverride,
  openNewLeadModal,
  openImportModal,
  openProspectorModal,
}: AllLeadsProps) {
  const { role, permissions } = usePermissions()

  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage | ''>(defaultStage ?? '')
  const [assignedFilter, setAssignedFilter] = useState(defaultAssignedTo ?? '')
  const [typeFilter, setTypeFilter] = useState('')
  const [teamMembers, setTeamMembers] = useState<Array<{ _id: string; name: string; initials: string }>>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showNewLeadModal, setShowNewLeadModal] = useState(Boolean(openNewLeadModal))
  const [showImportModal, setShowImportModal] = useState(Boolean(openImportModal))
  const [showProspectorModal, setShowProspectorModal] = useState(Boolean(openProspectorModal))

  useEffect(() => {
    setShowNewLeadModal(Boolean(openNewLeadModal))
  }, [openNewLeadModal])

  useEffect(() => {
    setShowImportModal(Boolean(openImportModal))
  }, [openImportModal])

  useEffect(() => {
    setShowProspectorModal(Boolean(openProspectorModal))
  }, [openProspectorModal])

  // Keep local filters aligned with route-like props when switching sidebar items.
  useEffect(() => {
    setStageFilter(defaultStage ?? '')
  }, [defaultStage])

  useEffect(() => {
    if (defaultAssignedTo !== undefined) {
      setAssignedFilter(defaultAssignedTo ?? '')
    }
  }, [defaultAssignedTo])

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const leadsPath = mineOnly ? '/leads/mine' : '/leads?stage=all'

      const [leadRes, teamRes] = await Promise.all([
        apiFetch<{ leads: Lead[]; total: number }>(leadsPath),
        apiFetch<{ members: Array<{ _id: string; name: string; initials?: string }> }>('/team/members').catch(() => ({ members: [] })),
      ])

      setLeads(leadRes.leads)
      setTotal(leadRes.total)
      setTeamMembers(teamRes.members.map((m) => ({ _id: m._id, name: m.name, initials: m.initials ?? m.name.slice(0, 2).toUpperCase() })))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load leads'
      if (message.includes('401') || message.includes('403') || message.toLowerCase().includes('session expired')) {
        sessionStorage.removeItem('crm_portal_secure_session')
        setError('Session expired. Please sign in again.')
      } else if (message.includes('Failed to fetch')) {
        setError('Server is unreachable. Start backend with npm run dev:server')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  const filteredLeads = useMemo(() => {
    const normalizedSearch = search.toLowerCase()
    return leads.filter((lead) => {
      const uiStage = (API_STAGE_TO_STAGE[lead.stage] ?? 'Cold') as PipelineStage
      const matchSearch =
        !normalizedSearch ||
        lead.businessName.toLowerCase().includes(normalizedSearch) ||
        lead.ownerName.toLowerCase().includes(normalizedSearch)
      const matchStage = !stageFilter || uiStage === stageFilter
      const matchAssigned = !assignedFilter || lead.assignedTo._id === assignedFilter
      const matchType = !typeFilter || lead.businessType === typeFilter
      return matchSearch && matchStage && matchAssigned && matchType
    })
  }, [assignedFilter, leads, search, stageFilter, typeFilter])

  const title = titleOverride ?? defaultStage ?? 'All leads'

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
          <div className="flex items-center justify-center gap-4">
            <button onClick={refetch} className="text-sm text-[#6366f1] hover:text-[#818cf8]" type="button">
              Try again
            </button>
            {error.toLowerCase().includes('session expired') && (
              <button
                onClick={() => {
                  localStorage.removeItem('crm_access_token')
                  localStorage.removeItem('crm_refresh_token')
                  localStorage.removeItem('crm_user')
                  sessionStorage.removeItem('crm_portal_secure_session')
                  window.location.reload()
                }}
                className="text-sm text-[#ef4444] hover:text-[#f87171]"
                type="button"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    )

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Leads</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            {title}
            <span className="ml-3 font-['Geist_Mono'] text-[14px] font-normal text-[#52525b]">{defaultStage ? filteredLeads.length : total}</span>
          </h1>
        </div>

        {(role === 'admin' || role === 'bd_intern') && (
          <button
            onClick={() => setShowNewLeadModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]"
          >
            <Plus size={14} />
            Add lead
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3f3f46]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business or owner..."
            className="w-full rounded-xl bg-[#111111] py-2 pl-8 pr-3 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>

        {!defaultStage && (
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter((e.target.value as PipelineStage) || '')}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">All stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        {defaultAssignedTo === undefined && role === 'admin' && (
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
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
          className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
        >
          <option value="">All types</option>
          {['restaurant', 'clinic', 'salon', 'shop', 'other'].map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {permissions?.leads?.create && (
          <button
            onClick={() => setShowImportModal(true)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] transition-colors hover:bg-[#1a1a1a]"
          >
            Import CSV
          </button>
        )}

        {permissions?.prospector?.view && (
          <button
            onClick={() => setShowProspectorModal(true)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] transition-colors hover:bg-[#1a1a1a]"
          >
            Prospect Leads
          </button>
        )}
      </div>

      <div className="mb-1 hidden grid-cols-[1fr_160px_150px_140px_100px_32px] gap-4 px-3 py-2 lg:grid">
        {['Business', 'Owner', 'Stage', 'Assigned', 'Last activity', ''].map((col) => (
          <p key={col} className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
            {col}
          </p>
        ))}
      </div>

      {filteredLeads.map((lead) => {
        const uiStage = (API_STAGE_TO_STAGE[lead.stage] ?? 'Cold') as PipelineStage
        const Icon = stageIcons[uiStage]
        return (
          <div key={lead._id}>
            <div
              onClick={() => setSelectedLeadId(lead._id)}
              className="group hidden cursor-pointer grid-cols-[1fr_160px_150px_140px_100px_32px] gap-4 rounded-xl border-b border-[#1a1a1a] px-3 py-2.5 hover:bg-[#1a1a1a] last:border-b-0 lg:grid"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] text-[#a1a1aa] transition-colors duration-100 group-hover:text-[#fafafa]">{lead.businessName}</p>
              </div>

              <p className="truncate text-[13px] text-[#71717a]">{lead.ownerName}</p>

              <div className="flex items-center gap-1.5">
                <span className="text-[#71717a]">
                  <Icon size={13} />
                </span>
                <span className="text-[12px] text-[#a1a1aa]">{uiStage}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                  <span className="text-[9px] text-[#a1a1aa]">{lead.assignedTo.initials}</span>
                </div>
                <p className="truncate text-[12px] text-[#71717a]">{lead.assignedTo.name}</p>
              </div>

              <p className="font-['Geist_Mono'] text-[11px] text-[#71717a]">{formatRelativeTime(lead.lastActivityAt)}</p>

              <ChevronRight size={13} className="text-[#52525b] transition-colors duration-100 group-hover:text-[#a1a1aa]" />
            </div>

            <button
              type="button"
              onClick={() => setSelectedLeadId(lead._id)}
              className="mb-2 w-full rounded-xl border border-[#1f1f1f] bg-[#111111] p-4 text-left transition-colors hover:bg-[#1a1a1a] lg:hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#fafafa]">{lead.businessName}</p>
                  <p className="mt-1 truncate text-[12px] text-[#a1a1aa]">{lead.ownerName}</p>
                </div>
                <ChevronRight size={14} className="shrink-0 text-[#71717a]" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="text-[#52525b]">Stage</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[#a1a1aa]">
                    <Icon size={12} />
                    <span>{uiStage}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[#52525b]">Assigned</p>
                  <p className="mt-0.5 truncate text-[#a1a1aa]">{lead.assignedTo.name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[#52525b]">Last activity</p>
                  <p className="mt-0.5 font-['Geist_Mono'] text-[#71717a]">{formatRelativeTime(lead.lastActivityAt)}</p>
                </div>
              </div>
            </button>
          </div>
        )
      })}

      {filteredLeads.length === 0 && !loading && <div className="py-16 text-center text-sm text-[#3f3f46]">No leads match your filters</div>}

      <NewLeadModal
        isOpen={showNewLeadModal}
        onClose={() => setShowNewLeadModal(false)}
        onCreated={() => {
          refetch()
          setShowNewLeadModal(false)
        }}
      />

      <ImportLeadsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => {
          refetch()
          setShowImportModal(false)
        }}
      />

      <ProspectorModal
        isOpen={showProspectorModal}
        onClose={() => setShowProspectorModal(false)}
        isAdmin={role === 'admin'}
        teamMembers={teamMembers}
        onImported={() => {
          refetch()
        }}
      />

      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdated={() => {
          refetch()
        }}
      />
    </div>
  )
}
