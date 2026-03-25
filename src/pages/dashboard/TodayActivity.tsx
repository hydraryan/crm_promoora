import { useCallback, useEffect, useMemo, useState } from 'react'
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
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => void fetchData()} className="text-[#6366f1] text-sm hover:text-[#818cf8]" type="button">
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

  if (!data)
    return (
      <div className="min-h-full bg-[#0a0a0a] px-8 py-7 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[#52525b] text-sm">No activity data available yet.</p>
          <button onClick={() => void fetchData()} className="text-[#6366f1] text-sm hover:text-[#818cf8]" type="button">
            Reload
          </button>
        </div>
      </div>
    )

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7 space-y-6">
      <div className="flex items-center gap-8 mb-2">
        <div>
          <p className="text-[28px] font-['Geist_Mono'] font-medium text-[#fafafa]">{data.activity.totalToday}</p>
          <p className="text-[11px] text-[#52525b] mt-0.5">actions today</p>
        </div>
        <div className="w-px h-8 bg-[#1f1f1f]" />
        <div>
          <p className="text-[28px] font-['Geist_Mono'] font-medium text-[#fafafa]">
            {data.followups.filter((f) => !f.isDone).length}
          </p>
          <p className="text-[11px] text-[#52525b] mt-0.5">follow-ups pending</p>
        </div>
        <div className="w-px h-8 bg-[#1f1f1f]" />
        <div>
          <p className="text-[28px] font-['Geist_Mono'] font-medium text-[#fafafa]">{data.newLeads.total}</p>
          <p className="text-[11px] text-[#52525b] mt-0.5">leads added today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-5 gap-6">
        <div className="2xl:col-span-3 bg-[#111111] rounded-2xl p-5">
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

        <div className="2xl:col-span-2 bg-[#111111] rounded-2xl p-5">
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
                  className="text-[11px] text-[#6366f1] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  Mark done
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="grid grid-cols-[1fr_160px_140px_140px_110px] gap-4 px-3 py-2 border-b border-[#1a1a1a]">
          {['Business name', 'Owner', 'Stage', 'Assigned to', 'Added at'].map((heading) => (
            <p key={heading} className="text-[11px] font-medium uppercase tracking-wider text-[#3f3f46]">
              {heading}
            </p>
          ))}
        </div>

        <div className="divide-y divide-[#161616]">
          {data.newLeads.leads.map((lead) => (
            <div key={lead._id} className="grid grid-cols-[1fr_160px_140px_140px_110px] gap-4 px-3 py-2.5">
              <p className="text-[13px] text-[#a1a1aa] truncate">{lead.businessName}</p>
              <p className="text-[12px] text-[#71717a] truncate">{lead.ownerName}</p>
              <p className="text-[12px] text-[#71717a] truncate">{lead.stage}</p>
              <p className="text-[12px] text-[#52525b] truncate">{lead.assignedTo.name}</p>
              <p className="text-[11px] text-[#3f3f46] font-['Geist_Mono']">{formatRelativeTime(lead.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
