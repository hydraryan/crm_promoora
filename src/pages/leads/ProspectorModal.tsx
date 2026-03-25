import { useMemo, useState } from 'react'
import { Loader2, Search, Sparkles, X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'

type Candidate = {
  candidateId: string
  source: 'google-maps' | 'justdial' | 'indiamart'
  name: string
  address?: string
  phone?: string
  website?: string
  category?: string
  rating?: number
  reviewCount: number
  isActive: boolean
  activeScore: number
  footfallBand: 'low' | 'medium' | 'high'
  footfallDailyMin: number
  footfallDailyMax: number
  confidence: 'low' | 'medium' | 'high'
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
}

const sourceLabels: Record<Candidate['source'], string> = {
  'google-maps': 'Google Maps',
  justdial: 'Justdial',
  indiamart: 'IndiaMART',
}

export default function ProspectorModal({ isOpen, onClose, onImported }: ProspectorModalProps) {
  const [query, setQuery] = useState('')
  const [minReviews, setMinReviews] = useState(200)
  const [recencyDays, setRecencyDays] = useState(30)
  const [maxResults, setMaxResults] = useState(25)
  const [isRunning, setIsRunning] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [job, setJob] = useState<ProspectorJob | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selectedCount = selectedIds.length

  const candidates = useMemo(() => job?.candidates ?? [], [job])

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

    try {
      const response = await apiFetch<{ job: ProspectorJob }>('/prospector/jobs', {
        method: 'POST',
        body: JSON.stringify({
          query: query.trim(),
          minReviews,
          recencyDays,
          maxResults,
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

    setIsImporting(true)
    setError(null)

    try {
      const response = await apiFetch<{
        imported: number
        skippedDuplicates: number
        skippedInvalid: number
        selected: number
      }>(`/prospector/jobs/${job._id}/import`, {
        method: 'POST',
        body: JSON.stringify({ candidateIds: selectedIds }),
      })

      setInfo(
        `Imported ${response.imported}/${response.selected}. Skipped duplicates: ${response.skippedDuplicates}, invalid: ${response.skippedInvalid}.`
      )
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
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_120px_120px_120px_150px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. top cafes in chandigarh"
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

          <div className="grid grid-cols-1 gap-2 text-[11px] text-[#71717a] sm:grid-cols-3">
            <p>Min reviews (default 200)</p>
            <p>Recent review window (days)</p>
            <p>Result cap (1-200)</p>
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

          <div className="overflow-hidden rounded-xl border border-[#1f1f1f]">
            <div className="grid grid-cols-[34px_1.2fr_1.4fr_110px_90px_90px_160px_150px] gap-3 border-b border-[#1f1f1f] bg-[#121212] px-3 py-2 text-[11px] uppercase tracking-wider text-[#52525b]">
              <p></p>
              <p>Business</p>
              <p>Address</p>
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
                    className="grid cursor-pointer grid-cols-[34px_1.2fr_1.4fr_110px_90px_90px_160px_150px] gap-3 border-b border-[#191919] px-3 py-2.5 text-sm text-[#d4d4d8] hover:bg-[#161616]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(candidate.candidateId)}
                      onChange={() => toggleSelect(candidate.candidateId)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#f4f4f5]">{candidate.name}</p>
                      <p className="truncate text-xs text-[#71717a]">{candidate.category || 'unknown'}</p>
                    </div>
                    <p className="line-clamp-2 text-xs text-[#a1a1aa]">{candidate.address || '—'}</p>
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
          <p className="text-xs text-[#71717a]">Selected: {selectedCount}</p>
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