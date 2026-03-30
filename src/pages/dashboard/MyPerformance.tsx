import { useCallback, useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatePanel } from '@/components/ui/state-panel'
import { apiFetch } from '@/utils/apiFetch'

interface PerformanceData {
  user: { name: string; initials: string; role: string }
  currentMonth: {
    leadsContacted: number
    proposalsSent: number
    followUpsDone: number
    dealsWon: number
    dealsLost: number
    conversionRate: number
  }
  trend: { date: string; leadsContacted: number; followUpsDone: number }[]
  topLead: { businessName: string; stage: string } | null
}

interface TeamMember {
  _id: string
  name: string
}

interface TeamMembersResponse {
  members: TeamMember[]
}

export default function MyPerformance() {
  const user = useMemo(() => {
    const raw = localStorage.getItem('crm_user') ?? localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as { id?: string; _id?: string; role?: string }) : {}
  }, [])

  const role = user.role ?? 'viewer'
  const userId = user.id ?? user._id ?? ''

  const [data, setData] = useState<PerformanceData | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedUserId, setSelectedUserId] = useState(userId)
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
      if (role !== 'admin' && role !== 'bd_intern') {
        setLoading(false)
        return
      }

      const endpoint = role === 'admin' && selectedUserId && selectedUserId !== userId ? `/performance/user/${selectedUserId}` : '/performance/me'
      const performance = await apiFetch<PerformanceData>(endpoint)
      setData(performance)

      if (role === 'admin') {
        const members = await apiFetch<TeamMembersResponse>('/team/members')
        setTeamMembers(members.members)
      }
    } catch {
      setError('Failed to load performance metrics')
    } finally {
      setLoading(false)
    }
  }, [role, selectedUserId, userId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (role !== 'admin' && role !== 'bd_intern') {
    return (
      <StatePanel
        title="Access limited"
        message="Performance tracking is available for BD team members."
      />
    )
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
        title="Unable to load performance"
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
        title="No performance data"
        message="No performance data is available yet."
        actionLabel="Reload"
        onAction={() => void fetchData()}
      />
    )

  const maxTrend = Math.max(...data.trend.map((d) => d.leadsContacted), 1)

  return (
    <div className="min-h-full space-y-6 bg-[#0a0a0a] px-4 py-6 sm:px-8 sm:py-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#404040] mb-1">This month</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">My performance</h1>
        </div>

        {role === 'admin' && (
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-[#111111] border border-[#1f1f1f] text-[#a1a1aa] text-[13px] rounded-xl px-3 py-2 outline-none focus:border-[#6366f1]"
          >
            <option value={userId}>My stats</option>
            {teamMembers.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Leads contacted', value: data.currentMonth.leadsContacted, color: 'text-[#fafafa]' },
          { label: 'Proposals sent', value: data.currentMonth.proposalsSent, color: 'text-[#fafafa]' },
          { label: 'Follow-ups done', value: data.currentMonth.followUpsDone, color: 'text-[#fafafa]' },
          { label: 'Deals won', value: data.currentMonth.dealsWon, color: 'text-[#22c55e]' },
          { label: 'Conversion rate', value: `${data.currentMonth.conversionRate}%`, color: 'text-[#fafafa]' },
        ].map((item) => (
          <div key={item.label} className="bg-[#111111] rounded-2xl p-5">
            <p className="text-[13px] text-[#52525b] font-medium">{item.label}</p>
            <p className={`mt-3 text-[28px] font-medium font-['Geist_Mono'] ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#111111] rounded-2xl p-5">
        <p className="text-[13px] font-medium text-[#a1a1aa] mb-5">Last 7 days</p>
        <div className="flex items-end gap-3 h-28">
          {data.trend.map((day) => {
            const heightPct = (day.leadsContacted / maxTrend) * 100
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex flex-col justify-end" style={{ height: '96px' }}>
                  <div
                    className="w-full bg-[#6366f1] rounded-sm transition-all duration-700"
                    style={{
                      height: `${heightPct}%`,
                      opacity: 0.4 + (heightPct / 100) * 0.6,
                      minHeight: day.leadsContacted > 0 ? '3px' : '0',
                    }}
                  />
                </div>
                <p className="text-[10px] text-[#3f3f46]">
                  {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2)}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <div className="w-2 h-2 rounded-sm bg-[#6366f1] opacity-70" />
          <p className="text-[11px] text-[#52525b]">Leads contacted per day</p>
        </div>
      </div>

      {data.topLead && (
        <div className="bg-[#111111] rounded-2xl p-5">
          <p className="text-[13px] font-medium text-[#a1a1aa] mb-3">Best lead this month</p>
          <div className="flex items-center gap-4 px-3 py-2.5 rounded-xl bg-[#1a1a1a]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
            <p className="flex-1 text-[13px] text-[#fafafa]">{data.topLead.businessName}</p>
            <p className="text-[11px] text-[#52525b]">{data.topLead.stage}</p>
          </div>
        </div>
      )}
    </div>
  )
}
