import { useCallback, useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatePanel } from '@/components/ui/state-panel'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface TodayActivityItem {
  _id: string
  actor: { name: string; initials: string; _id: string }
  type: 'note' | 'lead_created' | 'proposal_sent' | 'stage_changed' | 'followup_done' | 'client_added'
  description: string
  targetName: string
  targetId: string
  createdAt: string
}

interface TodayActivityResponse {
  activities: TodayActivityItem[]
  totalToday: number
}

interface TodayFollowUp {
  _id: string
  businessName: string
  ownerName: string
  type: 'call' | 'walk-in' | 'whatsapp'
  assignedTo: { name: string; _id: string }
  dueAt: string
  isOverdue: boolean
  isDone: boolean
}

interface TodayFollowUpsResponse {
  followups: TodayFollowUp[]
}

interface LeadToday {
  _id: string
  businessName: string
  ownerName: string
  stage: string
  assignedTo: { name: string }
  createdAt: string
}

interface LeadsTodayResponse {
  leads: LeadToday[]
  total: number
}

interface CombinedData {
  activity: TodayActivityResponse
  followups: TodayFollowUp[]
  newLeads: LeadsTodayResponse
}

function hourLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (60 * 60 * 1000))
  if (hours < 1) return 'THIS HOUR'
  if (hours === 1) return '1 HOUR AGO'
  return `${hours} HOURS AGO`
}

export default function TodayActivity() {
  const [data, setData] = useState<CombinedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      const [activity, followups, newLeads] = await Promise.all([
        apiFetch<TodayActivityResponse>('/activity/today'),
        apiFetch<TodayFollowUpsResponse>('/followups/today'),
        apiFetch<LeadsTodayResponse>('/leads?createdToday=true'),
      ])

      setData({
        activity,
        followups: [...followups.followups].sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue)),
        newLeads,
      })
    } catch {
      setError('Failed to load today activity')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const groupedActivities = useMemo(() => {
    if (!data) return []

    const groups: Array<{ label: string; items: TodayActivityItem[] }> = []
    data.activity.activities.forEach((item) => {
      const label = hourLabel(item.createdAt)
      const current = groups[groups.length - 1]
      if (!current || current.label !== label) {
        groups.push({ label, items: [item] })
      } else {
        current.items.push(item)
      }
    })

    return groups
  }, [data])

  const markDone = async (id: string) => {
    if (!data) return

    const prev = data.followups
    setData({ ...data, followups: data.followups.filter((f) => f._id !== id) })

    try {
      await apiFetch(`/followups/${id}/done`, { method: 'PATCH' })
    } catch {
      setData({ ...data, followups: prev })
      setError('Failed to mark follow-up as done')
    }
  }

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-4 py-6 sm:px-8 sm:py-7">
        <Skeleton className="h-12 w-64" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )

  if (error)
    return (
      <StatePanel
        tone="error"
        title="Unable to load today activity"
        message={error}
        actionLabel="Try again"
        onAction={() => void fetchData()}
        secondaryActionLabel={error.toLowerCase().includes('session expired') ? 'Log out' : undefined}
        onSecondaryAction={error.toLowerCase().includes('session expired') ? clearSessionAndReload : undefined}
      />
    )

  if (!data)
    return (
      <StatePanel
        title="No activity data"
        message="No activity data is available yet."
        actionLabel="Reload"
        onAction={() => void fetchData()}
      />
    )

  return (
    <div className="min-h-full space-y-6 bg-[#0a0a0a] px-4 py-6 sm:px-8 sm:py-7">
      <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
        <div className="rounded-2xl bg-[#111111] px-4 py-3">
          <p className="text-[28px] font-['Geist_Mono'] font-medium text-[#fafafa]">{data.activity.totalToday}</p>
          <p className="text-[11px] text-[#52525b] mt-0.5">actions today</p>
        </div>

        <div className="rounded-2xl bg-[#111111] px-4 py-3">
          <p className="text-[28px] font-['Geist_Mono'] font-medium text-[#fafafa]">
            {data.followups.filter((f) => !f.isDone).length}
          </p>
          <p className="text-[11px] text-[#52525b] mt-0.5">follow-ups pending</p>
        </div>

        <div className="rounded-2xl bg-[#111111] px-4 py-3">
          <p className="text-[28px] font-['Geist_Mono'] font-medium text-[#fafafa]">{data.newLeads.total}</p>
          <p className="text-[11px] text-[#52525b] mt-0.5">leads added today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-2xl bg-[#111111] p-5 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-medium text-[#a1a1aa]">Activity</p>
            <p className="text-[11px] text-[#52525b] font-['Geist_Mono']">{data.activity.totalToday}</p>
          </div>

          <div className="space-y-1">
            {groupedActivities.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] text-[#3f3f46] uppercase tracking-widest px-3 py-1.5">{group.label}</p>
                {group.items.map((item) => (
                  <div key={item._id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[#1a1a1a]">
                    <div className="w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-medium text-[#71717a]">{item.actor.initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#71717a] leading-relaxed">
                        <span className="text-[#a1a1aa] font-medium">{item.actor.name}</span>
                        {' · '}
                        <span className="text-[#a1a1aa]">{item.targetName}</span>
                      </p>
                      <p className="text-[11px] text-[#52525b] mt-0.5">{item.description}</p>
                      <p className="text-[10px] text-[#3f3f46] mt-0.5">{formatRelativeTime(item.createdAt)}</p>
                    </div>

                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${
                        item.type === 'lead_created'
                          ? 'bg-[#6366f1]'
                          : item.type === 'proposal_sent'
                            ? 'bg-[#f59e0b]'
                            : item.type === 'followup_done'
                              ? 'bg-[#22c55e]'
                              : item.type === 'stage_changed'
                                ? 'bg-[#3b82f6]'
                                : 'bg-[#3f3f46]'
                      }`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#111111] p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-medium text-[#a1a1aa]">Today's follow-ups</p>
            <p className="text-[11px] text-[#52525b] font-['Geist_Mono']">{data.followups.length}</p>
          </div>

          <div className="space-y-px">
            {data.followups.map((item) => (
              <div key={item._id} className="group flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#1a1a1a]">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.isOverdue ? 'bg-[#ef4444]' : 'bg-[#3f3f46]'}`} />
                <p className="flex-1 text-[13px] text-[#a1a1aa] truncate">{item.businessName}</p>
                <p className="text-[11px] text-[#52525b] shrink-0">{item.type}</p>
                <button
                  type="button"
                  onClick={() => void markDone(item._id)}
                  className="shrink-0 text-[11px] text-[#6366f1] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                >
                  Mark done
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="hidden grid-cols-[1fr_160px_140px_140px_110px] gap-4 border-b border-[#1a1a1a] px-3 py-2 lg:grid">
          {['Business name', 'Owner', 'Stage', 'Assigned to', 'Added at'].map((heading) => (
            <p key={heading} className="text-[11px] font-medium uppercase tracking-wider text-[#3f3f46]">
              {heading}
            </p>
          ))}
        </div>

        <div className="divide-y divide-[#161616]">
          {data.newLeads.leads.map((lead) => (
            <div key={lead._id}>
              <div className="hidden grid-cols-[1fr_160px_140px_140px_110px] gap-4 px-3 py-2.5 lg:grid">
                <p className="truncate text-[13px] text-[#a1a1aa]">{lead.businessName}</p>
                <p className="truncate text-[12px] text-[#71717a]">{lead.ownerName}</p>
                <p className="truncate text-[12px] text-[#71717a]">{lead.stage}</p>
                <p className="truncate text-[12px] text-[#52525b]">{lead.assignedTo.name}</p>
                <p className="text-[11px] font-['Geist_Mono'] text-[#3f3f46]">{formatRelativeTime(lead.createdAt)}</p>
              </div>

              <div className="rounded-xl px-3 py-3 lg:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[#a1a1aa]">{lead.businessName}</p>
                    <p className="mt-0.5 text-[11px] text-[#52525b]">{lead.ownerName}</p>
                  </div>
                  <p className="shrink-0 text-[11px] font-['Geist_Mono'] text-[#3f3f46]">{formatRelativeTime(lead.createdAt)}</p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#71717a]">
                  <span className="rounded-md bg-[#1a1a1a] px-2 py-0.5">{lead.stage}</span>
                  <span className="rounded-md bg-[#1a1a1a] px-2 py-0.5">{lead.assignedTo.name}</span>
                </div>
              </div>
            </div>
          ))}

          {data.newLeads.leads.length === 0 && (
            <p className="px-3 py-6 text-center text-[12px] text-[#52525b]">No leads created today.</p>
          )}
        </div>
      </div>
    </div>
  )
}
