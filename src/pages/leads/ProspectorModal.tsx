import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Sparkles, X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'

type SearchMode = 'discovery' | 'quality'

type Candidate = {
  candidateId: string
  source: 'google-maps' | 'justdial' | 'indiamart'
  placeId?: string
  name: string
  address?: string
  formattedAddress?: string
  phone?: string
  website?: string
  placeUrl?: string
  category?: string
  primaryType?: string
  rating?: number
  reviewCount: number
  isActive: boolean
  activeScore: number
  footfallBand: 'low' | 'medium' | 'high'
  footfallDailyMin: number
  footfallDailyMax: number
  confidence: 'low' | 'medium' | 'high'
  signals: string[]
  openingHours?: string[]
}

type ProviderError = {
  source: 'google-maps' | 'justdial' | 'indiamart'
  message: string
}

type ProspectorJob = {
  _id: string
  query: string
  status: 'pending' | 'completed' | 'failed'
  candidates: Candidate[]
  providerErrors: ProviderError[]
}

interface ProspectorModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  isAdmin: boolean
  teamMembers: Array<{ _id: string; name: string; initials: string }>
}

const sourceLabels: Record<Candidate['source'], string> = {
  'google-maps': 'Google Maps',
  justdial: 'Justdial',
  indiamart: 'IndiaMART',
}

export default function ProspectorModal({ isOpen, onClose, onImported, isAdmin, teamMembers }: ProspectorModalProps) {
  const [assignedToId, setAssignedToId] = useState('')
  const [reassignToId, setReassignToId] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('discovery')
  const [query, setQuery] = useState('')
  const [minReviews, setMinReviews] = useState(30)
  const [recencyDays, setRecencyDays] = useState(30)
  const [maxResults, setMaxResults] = useState(25)
  const [onlyNoWebsite, setOnlyNoWebsite] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [job, setJob] = useState<ProspectorJob | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [createdLeadIds, setCreatedLeadIds] = useState<string[]>([])
  const [showReassignPanel, setShowReassignPanel] = useState(false)

  const selectedCount = selectedIds.length

  const candidates = useMemo(() => job?.candidates ?? [], [job])

  useEffect(() => {
    if (!isOpen) {
      setAssignedToId('')
      setReassignToId('')
      setCreatedLeadIds([])
      setShowReassignPanel(false)
      setJob(null)
      setSelectedIds([])
      setError(null)
      setInfo(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const runProspector = async () => {
    if (query.trim().length < 3) {
      setError('Enter at least 3 characters in query')
      return
    }

    setIsRunning(true)
    setError(null)
    setInfo(null)
    setJob(null)
    setSelectedIds([])
    setCreatedLeadIds([])
    setShowReassignPanel(false)

    try {
      const response = await apiFetch<{ job: ProspectorJob }>('/prospector/jobs', {
        method: 'POST',
        body: JSON.stringify({
          query: query.trim(),
          searchMode,
          minReviews,
          recencyDays,
          maxResults,
          onlyNoWebsite,
          assignedTo: assignedToId || undefined,
          providers: ['google-maps'],
        }),
      })

      setJob(response.job)
      setSelectedIds(response.job.candidates.map((item) => item.candidateId))
      setInfo(`Found ${response.job.candidates.length} candidates for review.`)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to run prospector query')
    } finally {
      setIsRunning(false)
    }
  }

  const importSelected = async () => {
    if (!job || selectedIds.length === 0) {
      setError('Select at least one candidate to import')
      return
    }

    if (isAdmin && !assignedToId) {
      setError('Select a teammate to assign these leads to before importing')
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const response = await apiFetch<{
        imported: number
        skippedDuplicates: number
        skippedInvalid: number
        selected: number
        createdLeadIds: string[]
      }>(`/prospector/jobs/${job._id}/import`, {
        method: 'POST',
        body: JSON.stringify({ candidateIds: selectedIds, assignedTo: isAdmin ? assignedToId : undefined }),
      })

      setCreatedLeadIds(response.createdLeadIds ?? [])
      setInfo(
        `Imported ${response.imported}/${response.selected}. Skipped duplicates: ${response.skippedDuplicates}, invalid: ${response.skippedInvalid}.`
      )
      setShowReassignPanel(true)
      setReassignToId(assignedToId)
      onImported()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import selected candidates')
    } finally {
      setIsImporting(false)
    }
  }

  const toggleSelect = (candidateId: string) => {
    setSelectedIds((previous) => (previous.includes(candidateId) ? previous.filter((id) => id !== candidateId) : [...previous, candidateId]))
  }

  const applyMode = (mode: SearchMode) => {
    setSearchMode(mode)
    if (mode === 'quality') {
      setMinReviews((previous) => Math.max(previous, 120))
      setRecencyDays((previous) => Math.max(previous, 30))
    } else {
      setMinReviews((previous) => Math.min(previous, 30))
    }
  }

  const bulkReassignImported = async () => {
    if (!isAdmin || createdLeadIds.length === 0) return
    if (!reassignToId) {
      setError('Select a teammate to reassign the imported leads to')
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      await Promise.all(
        createdLeadIds.map((leadId) =>
          apiFetch(`/leads/${leadId}`, {
            method: 'PATCH',
            body: JSON.stringify({ assignedTo: reassignToId }),
          })
        )
      )

      setInfo(`Reassigned ${createdLeadIds.length} imported leads in one action.`)
      setShowReassignPanel(false)
      onImported()
    } catch (reassignError) {
      setError(reassignError instanceof Error ? reassignError.message : 'Failed to bulk reassign imported leads')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-6xl rounded-2xl border border-[#222] bg-[#0f0f0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#52525b]">Lead Prospector</p>
            <h2 className="mt-1 text-lg font-semibold text-[#fafafa]">Generate high-intent business leads</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#71717a] transition-colors hover:bg-[#1a1a1a] hover:text-[#fafafa]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyMode('discovery')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                searchMode === 'discovery'
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-[#141414] text-[#a1a1aa] hover:bg-[#1a1a1a]'
              }`}
            >
              Discovery mode
            </button>
            <button
              type="button"
              onClick={() => applyMode('quality')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                searchMode === 'quality'
                  ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                  : 'bg-[#141414] text-[#a1a1aa] hover:bg-[#1a1a1a]'
              }`}
            >
              Quality mode
            </button>
            <p className="text-xs text-[#71717a]">
              {searchMode === 'discovery'
                ? 'Best for newly opened or lower-review businesses.'
                : 'Best for established businesses with stronger social proof.'}
            </p>
          </div>

          {isAdmin ? (
            <div className="rounded-xl border border-[#242424] bg-[#121212] p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-[#52525b]">Admin assignment</p>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                <div>
                  <label className="mb-1 block text-xs text-[#71717a]">Assign imported leads to</label>
                  <select
                    value={assignedToId}
                    onChange={(event) => setAssignedToId(event.target.value)}
                    className="w-full rounded-xl border border-[#242424] bg-[#141414] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-[#4f46e5]"
                  >
                    <option value="">Select a teammate</option>
                    {teamMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-1 text-xs text-[#71717a]">One-click flow</p>
                  <p className="text-xs text-[#a1a1aa]">Pick one teammate here and all imported leads will be assigned to them in a single import action.</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_120px_120px_120px_150px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. newly opened cafes in delhi"
                className="w-full rounded-xl border border-[#242424] bg-[#141414] py-2.5 pl-9 pr-3 text-sm text-[#e4e4e7] outline-none placeholder:text-[#52525b] focus:border-[#4f46e5]"
              />
            </div>

            <input
              type="number"
              min={0}
              value={minReviews}
              onChange={(event) => setMinReviews(Math.max(0, Number(event.target.value) || 0))}
              className="rounded-xl border border-[#242424] bg-[#141414] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-[#4f46e5]"
              title="Minimum reviews"
            />

            <input
              type="number"
              min={1}
              value={recencyDays}
              onChange={(event) => setRecencyDays(Math.max(1, Number(event.target.value) || 1))}
              className="rounded-xl border border-[#242424] bg-[#141414] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-[#4f46e5]"
              title="Recent review window (days)"
            />

            <input
              type="number"
              min={1}
              max={200}
              value={maxResults}
              onChange={(event) => setMaxResults(Math.min(200, Math.max(1, Number(event.target.value) || 1)))}
              className="rounded-xl border border-[#242424] bg-[#141414] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-[#4f46e5]"
              title="Maximum results"
            />

            <div className="flex items-center gap-2 rounded-xl border border-[#242424] bg-[#141414] px-3 py-2.5">
              <input
                id="no-website-toggle"
                type="checkbox"
                checked={onlyNoWebsite}
                onChange={(e) => setOnlyNoWebsite(e.target.checked)}
                className="h-4 w-4 rounded border-[#2a2a2a] bg-[#0f0f0f] text-[#6366f1] focus:ring-0 focus:ring-offset-0"
              />
              <label htmlFor="no-website-toggle" className="cursor-pointer text-xs font-medium text-[#a1a1aa] transition-colors hover:text-[#f4f4f5]">
                No website only
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                void runProspector()
              }}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isRunning ? 'Running...' : 'Run search'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 text-[11px] text-[#71717a] sm:grid-cols-4">
            <p>{searchMode === 'quality' ? 'Min reviews (recommended 120+)' : 'Min reviews (default 30)'}</p>
            <p>Recent review window (days)</p>
            <p>Result cap (1-200)</p>
            <p>Use 10-30 for newly opened</p>
          </div>

          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
          {info && <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{info}</div>}

          {job?.providerErrors?.length ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <p className="text-xs font-medium text-amber-200">Provider notes</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-100">
                {job.providerErrors.map((providerError) => (
                  <li key={`${providerError.source}-${providerError.message}`}>• {sourceLabels[providerError.source]}: {providerError.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {isAdmin && showReassignPanel && createdLeadIds.length > 0 ? (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-indigo-200">Imported batch ready</p>
                  <p className="text-[11px] text-indigo-100/80">Reassign all imported leads in one action, without editing each lead manually.</p>
                </div>
                <p className="text-[11px] text-indigo-100/80">{createdLeadIds.length} leads imported</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <label className="mb-1 block text-xs text-indigo-100/80">Reassign imported batch to</label>
                  <select
                    value={reassignToId}
                    onChange={(event) => setReassignToId(event.target.value)}
                    className="w-full rounded-xl border border-indigo-500/20 bg-[#141414] px-3 py-2.5 text-sm text-[#e4e4e7] outline-none focus:border-indigo-400"
                  >
                    <option value="">Select a teammate</option>
                    {teamMembers.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void bulkReassignImported()
                  }}
                  disabled={isImporting || createdLeadIds.length === 0}
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isImporting ? <Loader2 size={14} className="animate-spin" /> : null}
                  Reassign batch
                </button>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-[#1f1f1f]">
            <div className="grid grid-cols-[34px_1.1fr_1.3fr_1fr_1.1fr_110px_90px_90px_160px_150px] gap-3 border-b border-[#1f1f1f] bg-[#121212] px-3 py-2 text-[11px] uppercase tracking-wider text-[#52525b]">
              <p></p>
              <p>Business</p>
              <p>Address</p>
              <p>Phone</p>
              <p>Website</p>
              <p>Source</p>
              <p>Reviews</p>
              <p>Score</p>
              <p>Footfall/day</p>
              <p>Confidence</p>
            </div>

            <div className="max-h-92.5 overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-[#52525b]">Run a query to preview candidates</div>
              ) : (
                candidates.map((candidate) => (
                  <label
                    key={candidate.candidateId}
                    className={`grid cursor-pointer grid-cols-[34px_1.1fr_1.3fr_1fr_1.1fr_110px_90px_90px_160px_150px] gap-3 border-b border-[#191919] px-3 py-2.5 text-sm transition-colors ${
                      !candidate.website ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]' : 'hover:bg-[#161616]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(candidate.candidateId)}
                      onChange={() => toggleSelect(candidate.candidateId)}
                      className="mt-1 accent-[#6366f1]"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#f4f4f5]">{candidate.name}</p>
                      <p className="truncate text-xs text-[#71717a]">{candidate.primaryType || candidate.category || 'unknown'}</p>
                      {candidate.signals?.length ? (
                        <p className="mt-0.5 truncate text-[10px] text-[#52525b]">Why: {candidate.signals.slice(0, 2).join(' · ')}</p>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs text-[#a1a1aa]">{candidate.formattedAddress || candidate.address || '—'}</p>
                    <p className="line-clamp-2 text-xs text-[#a1a1aa]">{candidate.phone || '—'}</p>
                    <div className="min-w-0">
                      {candidate.website ? (
                        <p className="line-clamp-2 text-xs text-[#a1a1aa]">
                          <a className="underline decoration-[#52525b] underline-offset-2 hover:text-[#f4f4f5]" href={candidate.website} rel="noreferrer" target="_blank">
                            {candidate.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        </p>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                          No website detected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#a1a1aa]">{sourceLabels[candidate.source]}</p>
                    <p className="text-xs text-[#e4e4e7]">{candidate.reviewCount}</p>
                    <p className="text-xs text-[#e4e4e7]">{candidate.activeScore}</p>
                    <p className="text-xs text-[#e4e4e7]">
                      {candidate.footfallBand} ({candidate.footfallDailyMin}-{candidate.footfallDailyMax})
                    </p>
                    <p className="text-xs uppercase tracking-wide text-[#a1a1aa]">{candidate.confidence}</p>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#1f1f1f] px-5 py-3">
          <div className="flex items-center gap-4">
            <p className="text-xs text-[#71717a]">Selected: {selectedCount}</p>
            {candidates.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedIds(candidates.map((c) => c.candidateId))}
                  className="text-[11px] font-medium text-[#71717a] hover:text-[#fafafa]"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(candidates.filter((c) => !c.website).map((c) => c.candidateId))}
                  className="text-[11px] font-medium text-amber-500/80 transition-colors hover:text-amber-400"
                >
                  Select only No Website
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[11px] font-medium text-[#71717a] hover:text-[#fafafa]"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#2a2a2a] px-3 py-2 text-sm text-[#b4b4b8] transition-colors hover:bg-[#171717]"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isImporting || selectedCount === 0 || !job}
              onClick={() => {
                void importSelected()
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4f46e5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting ? <Loader2 size={14} className="animate-spin" /> : null}
              Import selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}