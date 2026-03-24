import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Clock, Plus, Search } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { PROPOSAL_STATUSES, statusMeta, type Proposal, type ProposalStatus } from '@/utils/proposalConstants'
import ProposalBuilder from './ProposalBuilder'
import ProposalPreview from './ProposalPreview'

interface AllProposalsProps {
  defaultStatus?: ProposalStatus
  titleOverride?: string
  openBuilderOnMount?: boolean
}

export default function AllProposals({ defaultStatus, titleOverride, openBuilderOnMount = false }: AllProposalsProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatus ?? '')
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null)
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null)

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as { role?: string; _id?: string }
    } catch {
      return {}
    }
  }, [])

  const role = user.role ?? 'viewer'

  useEffect(() => {
    setStatusFilter(defaultStatus ?? '')
  }, [defaultStatus])

  useEffect(() => {
    if (openBuilderOnMount) {
      setEditingProposal(null)
      setShowBuilder(true)
    }
  }, [openBuilderOnMount])

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams()
      if (defaultStatus) query.set('status', defaultStatus)
      const data = await apiFetch<{ proposals: Proposal[]; total: number }>(`/proposals?${query.toString()}`)
      setProposals(data.proposals)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [defaultStatus])

  const filteredProposals = proposals.filter((proposal) => {
    const target = proposal.targetType === 'lead' ? proposal.lead : proposal.client
    const matchSearch =
      !search ||
      proposal.title.toLowerCase().includes(search.toLowerCase()) ||
      target?.businessName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || proposal.status === statusFilter
    return matchSearch && matchStatus
  })

  if (showBuilder) {
    return (
      <ProposalBuilder
        proposal={editingProposal}
        onBack={() => {
          setShowBuilder(false)
          setEditingProposal(null)
        }}
        onSaved={(saved) => {
          setShowBuilder(false)
          setEditingProposal(null)
          setPreviewProposal(saved)
          refetch()
        }}
        onPreview={(preview) => {
          setPreviewProposal(preview)
          setShowBuilder(false)
        }}
      />
    )
  }

  if (previewProposal) {
    return (
      <ProposalPreview
        proposal={previewProposal}
        role={role}
        onClose={() => setPreviewProposal(null)}
        onEdit={() => {
          setEditingProposal(previewProposal)
          setPreviewProposal(null)
          setShowBuilder(true)
        }}
        onUpdated={(updated) => {
          setPreviewProposal(updated)
          refetch()
        }}
      />
    )
  }

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Proposals</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            {titleOverride ?? 'All proposals'}
            <span className="ml-3 font-['Geist_Mono'] text-[14px] font-normal text-[#52525b]">{filteredProposals.length}</span>
          </h1>
        </div>

        {(role === 'admin' || role === 'bd_intern') && (
          <button
            onClick={() => {
              setEditingProposal(null)
              setShowBuilder(true)
            }}
            className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]"
          >
            <Plus size={14} />
            Create proposal
          </button>
        )}
      </div>

      {defaultStatus === 'Awaiting response' && filteredProposals.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/8 px-4 py-3">
          <Clock size={13} className="shrink-0 text-[#f59e0b]" />
          <p className="text-[12px] text-[#a1a1aa]">
            <span className="font-['Geist_Mono'] text-[#f59e0b]">{filteredProposals.length}</span> proposal{filteredProposals.length > 1 ? 's' : ''} waiting for a response - consider a follow-up call
          </p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3f3f46]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search proposals..."
            className="w-full rounded-xl bg-[#111111] py-2 pl-8 pr-3 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>

        {!defaultStatus && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]">
            <option value="">All statuses</option>
            {PROPOSAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <div className="rounded-xl bg-[#111111] px-4 py-3 text-sm text-[#52525b]">Loading proposals...</div>}
      {error && <div className="rounded-xl bg-[#111111] px-4 py-3 text-sm text-[#ef4444]">{error}</div>}

      {!loading && !error && (
        <>
          <div className="mb-1 grid grid-cols-[110px_1fr_180px_170px_220px_100px_32px] gap-4 px-3 py-2">
            {['#', 'Title', 'For', 'Status', 'Services', 'Created', ''].map((col) => (
              <p key={col} className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
                {col}
              </p>
            ))}
          </div>

          <div className="space-y-px">
            {filteredProposals.map((proposal) => {
              const target = proposal.targetType === 'lead' ? proposal.lead : proposal.client
              return (
                <div
                  key={proposal._id}
                  onClick={() => {
                    if (proposal.status === 'Draft' && (role === 'admin' || role === 'bd_intern')) {
                      setEditingProposal(proposal)
                      setShowBuilder(true)
                      return
                    }
                    setPreviewProposal(proposal)
                  }}
                  className="group grid cursor-pointer grid-cols-[110px_1fr_180px_170px_220px_100px_32px] gap-4 rounded-xl border-b border-[#1a1a1a] px-3 py-2.5 hover:bg-[#1a1a1a] last:border-b-0"
                >
                  <p className="self-center font-['Geist_Mono'] text-[11px] text-[#3f3f46]">{proposal.proposalNumber}</p>
                  <p className="self-center truncate text-[13px] text-[#a1a1aa] transition-colors duration-100 group-hover:text-[#fafafa]">{proposal.title}</p>

                  <div className="min-w-0 self-center">
                    <p className="truncate text-[12px] text-[#52525b]">{target?.businessName ?? '—'}</p>
                    <p className="truncate text-[11px] text-[#3f3f46]">{target?.ownerName ?? '—'}</p>
                  </div>

                  <div className="flex items-center gap-1.5 self-center">
                    <span style={{ color: statusMeta[proposal.status].color }}>{statusMeta[proposal.status].icon}</span>
                    <span className="text-[12px] text-[#71717a]">{proposal.status}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 self-center">
                    {proposal.serviceBlocks.slice(0, 2).map((block) => (
                      <span key={block.id} className="rounded-md bg-[#111111] px-2 py-0.5 text-[10px] text-[#71717a]">
                        {block.title}
                      </span>
                    ))}
                    {proposal.serviceBlocks.length > 2 && <span className="text-[10px] text-[#3f3f46]">+{proposal.serviceBlocks.length - 2}</span>}
                  </div>

                  <p className="self-center font-['Geist_Mono'] text-[11px] text-[#3f3f46]">
                    {new Date(proposal.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>

                  <ChevronRight size={13} className="self-center text-[#3f3f46] transition-colors duration-100 group-hover:text-[#52525b]" />
                </div>
              )
            })}
          </div>

          {filteredProposals.length === 0 && <div className="py-16 text-center text-sm text-[#3f3f46]">No proposals match your filters</div>}
        </>
      )}
    </div>
  )
}
