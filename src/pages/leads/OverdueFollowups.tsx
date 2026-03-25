import { useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { API_STAGE_TO_STAGE, stageIcons, type PipelineStage } from '@/utils/leadConstants'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface OverdueFollowup {
  _id: string
  lead: {
    _id: string
    businessName: string
    ownerName: string
    stage: string
    assignedTo: { _id: string; name: string; initials: string }
  }
  dueAt: string
  note?: string
  createdBy: { _id: string; name: string; initials: string }
}

export default function OverdueFollowups() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as { _id?: string; id?: string; role?: string }
    } catch {
      return {}
    }
  }, [])

  const role = user.role ?? 'viewer'
  const userId = user._id ?? user.id ?? ''

  const [followups, setFollowups] = useState<OverdueFollowup[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ followups: OverdueFollowup[]; total: number }>('/followups/overdue')
      setFollowups(data.followups)
      setTotal(data.total)
    } catch {
      setError('Failed to load overdue follow-ups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  async function markDone(followupId: string) {
    try {
      await apiFetch(`/followups/${followupId}/done`, { method: 'PATCH' })
      setFollowups((prev) => prev.filter((f) => f._id !== followupId))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch {
      setError('Unable to mark follow-up as done')
    }
  }

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
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Leads . Follow-ups</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            Overdue follow-ups
            <span className="ml-3 font-['Geist_Mono'] text-[14px] font-normal text-[#ef4444]">{total}</span>
          </h1>
        </div>
      </div>

      <div className="space-y-1">
        {followups.map((fu) => {
          const stage = (API_STAGE_TO_STAGE[fu.lead.stage] ?? 'Cold') as PipelineStage
          const Icon = stageIcons[stage]
          return (
            <div key={fu._id} className="group flex items-start gap-4 rounded-xl px-3 py-3 hover:bg-[#1a1a1a]">
              <div className="mt-0.5 shrink-0">
                <Clock size={13} className="text-[#ef4444]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-[#a1a1aa] group-hover:text-[#fafafa]">{fu.lead.businessName}</p>
                <p className="text-[11px] text-[#52525b]">{fu.lead.ownerName}</p>
                {fu.note && <p className="mt-0.5 truncate text-[11px] text-[#3f3f46]">{fu.note}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[#52525b]">
                  <Icon size={13} />
                </span>
                <span className="text-[11px] text-[#52525b]">{stage}</span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
                  <span className="text-[9px] text-[#71717a]">{fu.lead.assignedTo.initials}</span>
                </div>
                <p className="text-[11px] text-[#52525b]">{fu.lead.assignedTo.name}</p>
              </div>

              <p className="shrink-0 font-['Geist_Mono'] text-[11px] text-[#ef4444]">{formatRelativeTime(fu.dueAt)}</p>

              {(role === 'admin' || fu.lead.assignedTo._id === userId) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    markDone(fu._id)
                  }}
                  className="shrink-0 rounded-lg bg-[#1a1a1a] px-2.5 py-1 text-[11px] text-[#52525b] transition-colors duration-150 hover:bg-[#222222] hover:text-[#a1a1aa]"
                >
                  Mark done
                </button>
              )}
            </div>
          )
        })}
      </div>

      {followups.length === 0 && <p className="py-16 text-center text-sm text-[#3f3f46]">No overdue follow-ups</p>}
    </div>
  )
}
