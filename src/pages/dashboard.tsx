import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { usePermissions } from '@/context/PermissionContext'
import { Skeleton } from '@/components/ui/skeleton'
import { StatePanel } from '@/components/ui/state-panel'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface DashboardPageProps {
  userName: string
  onQuickAction?: (actionId: 'lead' | 'follow-up' | 'proposal' | 'client') => void
}

interface LeadItem {
  _id: string
  businessName: string
  ownerName: string
  stage: string
  createdAt: string
  lastActivityAt: string
  assignedTo: {
    _id: string
    name: string
  }
}

interface LeadsResponse {
  leads: LeadItem[]
  total: number
}

interface ClientItem {
  _id: string
  businessName: string
  ownerName: string
  status: 'Onboarding' | 'Active' | 'Inactive'
}

interface ClientsResponse {
  clients: ClientItem[]
  total: number
}

interface ProposalItem {
  _id: string
  proposalNumber: string
  title: string
  status: 'Draft' | 'Sent' | 'Awaiting response' | 'Accepted' | 'Rejected'
  sentAt?: string
  createdAt: string
  lead?: { businessName: string }
  client?: { businessName: string }
}

interface ProposalsResponse {
  proposals: ProposalItem[]
  total: number
}

interface FollowUpItem {
  _id: string
  businessName: string
  ownerName: string
  type: string
  dueAt: string
  isDone: boolean
  isOverdue: boolean
  assignedTo: {
    _id: string
    name: string
  }
}

interface FollowUpsResponse {
  followups: FollowUpItem[]
  total: number
  overdueCount: number
}

interface TodayActivityItem {
  _id: string
  actor: { name: string; initials: string }
  type: string
  description: string
  targetName: string
  createdAt: string
}

interface TodayActivityResponse {
  activities: TodayActivityItem[]
  totalToday: number
}

interface StageSummary {
  name: string
  count: number
}

interface PipelineSummaryResponse {
  totalLeads: number
  stages: StageSummary[]
}

interface BdPerformanceMember {
  _id: string
  name: string
  initials: string
  leadsContacted: number
  proposalsSent: number
}

interface BdPerformanceResponse {
  members: BdPerformanceMember[]
}

interface DashboardData {
  leads: LeadsResponse
  clients: ClientsResponse
  proposals: ProposalsResponse
  followupsToday: FollowUpsResponse
  followupsUpcoming: FollowUpsResponse
  activity: TodayActivityResponse
  pipeline: PipelineSummaryResponse
  team: BdPerformanceResponse | null
}

const EMPTY_FOLLOWUPS: FollowUpsResponse = {
  followups: [],
  total: 0,
  overdueCount: 0,
}

const EMPTY_ACTIVITY: TodayActivityResponse = {
  activities: [],
  totalToday: 0,
}

const quickActions = [
  { id: 'lead', label: 'Add lead', module: 'leads' },
  { id: 'follow-up', label: 'Log follow-up', module: 'followups' },
  { id: 'proposal', label: 'Create proposal', module: 'proposals' },
  { id: 'client', label: 'Add client', module: 'clients' },
] as const

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour <= 11) return 'Good morning'
  if (hour >= 12 && hour <= 16) return 'Good afternoon'
  return 'Good evening'
}

function animationStyle(delayMs: number): CSSProperties {
  return {
    animationDelay: `${delayMs}ms`,
    opacity: 0,
  }
}

function followupTypeLabel(type: string): string {
  if (type === 'Phone call' || type === 'call') return 'call'
  if (type === 'Walk-in' || type === 'walk-in') return 'walk-in'
  return 'whatsapp'
}

function dueLabel(iso: string): string {
  const now = new Date()
  const due = new Date(iso)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const dueDay = new Date(due)
  dueDay.setHours(0, 0, 0, 0)

  if (dueDay.getTime() < today.getTime()) return 'Overdue'
  if (dueDay.getTime() === today.getTime()) return 'Today'
  if (dueDay.getTime() === tomorrow.getTime()) return 'Tomorrow'

  const days = Math.ceil((dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  return `In ${days} days`
}

function sentDaysAgo(sentAt?: string, createdAt?: string): number {
  const source = sentAt ?? createdAt
  if (!source) return 0
  const diff = Date.now() - new Date(source).getTime()
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)))
}

export default function DashboardPage({ userName, onQuickAction }: DashboardPageProps) {
  const { permissions } = usePermissions()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canView = (module: string) => Boolean(permissions?.[module]?.view)
  const canCreate = (module: string) => Boolean(permissions?.[module]?.create)

  const clearSessionAndReload = () => {
    localStorage.removeItem('crm_access_token')
    localStorage.removeItem('crm_refresh_token')
    localStorage.removeItem('crm_user')
    sessionStorage.removeItem('crm_portal_secure_session')
    window.location.reload()
  }

  const showActivity = canView('team') && (canCreate('leads') || canCreate('followups') || canCreate('proposals'))
  const showProposals = canView('proposals') && canCreate('proposals')
  const showFollowUps = canView('followups') && canCreate('followups')
  const showPipeline = canView('leads')
  const showTeam = canView('team') && canCreate('team')
  const showFunnel = canView('leads') && canView('proposals')
  const showUpcoming = showFollowUps

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [leads, clients, proposals, followupsToday, pipeline] = await Promise.all([
        apiFetch<LeadsResponse>('/leads?stage=all'),
        apiFetch<ClientsResponse>('/clients'),
        apiFetch<ProposalsResponse>('/proposals'),
        apiFetch<FollowUpsResponse>('/followups/today'),
        apiFetch<PipelineSummaryResponse>('/leads/pipeline-summary'),
      ])

      setData({
        leads,
        clients,
        proposals,
        followupsToday,
        followupsUpcoming: EMPTY_FOLLOWUPS,
        activity: EMPTY_ACTIVITY,
        pipeline,
        team: null,
      })

      setLoading(false)

      void Promise.all([
        apiFetch<FollowUpsResponse>('/followups?view=upcoming'),
        apiFetch<TodayActivityResponse>('/activity/today'),
        showTeam ? apiFetch<BdPerformanceResponse>('/reports/bd-performance') : Promise.resolve(null),
      ])
        .then(([followupsUpcoming, activity, team]) => {
          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              followupsUpcoming,
              activity,
              team,
            }
          })
        })
        .catch(() => {
          // Keep already rendered critical data visible even if deferred calls fail.
        })
    } catch {
      setError('Failed to load dashboard overview data')
    } finally {
      setLoading(false)
    }
  }, [showTeam])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const visibleQuickActions = quickActions.filter((action) => canCreate(action.module))

  const metrics = useMemo(() => {
    if (!data) {
      return {
        leadsAddedThisWeek: 0,
        activeClients: 0,
        clientsOnboarding: 0,
        openProposals: 0,
        proposalsOverdue: 0,
        followUpsPending: 0,
      }
    }

    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - 7)

    const leadsAddedThisWeek = data.leads.leads.filter((lead) => new Date(lead.createdAt) >= weekStart).length
    const activeClients = data.clients.clients.filter((client) => client.status === 'Active').length
    const clientsOnboarding = data.clients.clients.filter((client) => client.status === 'Onboarding').length

    const openProposalsRows = data.proposals.proposals.filter(
      (proposal) => proposal.status === 'Draft' || proposal.status === 'Sent' || proposal.status === 'Awaiting response',
    )

    const proposalsOverdue = openProposalsRows.filter((proposal) => {
      if (!proposal.sentAt) return false
      const ageInDays = Math.floor((Date.now() - new Date(proposal.sentAt).getTime()) / (24 * 60 * 60 * 1000))
      return ageInDays >= 5
    }).length

    const followUpsPending = data.followupsToday.followups.filter((row) => !row.isDone).length

    return {
      leadsAddedThisWeek,
      activeClients,
      clientsOnboarding,
      openProposals: openProposalsRows.length,
      proposalsOverdue,
      followUpsPending,
    }
  }, [data])

  if (loading)
    return (
      <div className="min-h-full space-y-6 bg-[#0a0a0a] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-36" />
          </div>
          <div className="hidden gap-2 xl:flex">
            <Skeleton className="h-9 w-26" />
            <Skeleton className="h-9 w-30" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={`stat-${i}`} className="h-40" />
          ))}
        </div>

        <Skeleton className="h-76" />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-60" />
          </div>
          <div className="space-y-6 xl:col-span-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-56" />
          </div>
        </div>
      </div>
    )

  if (error)
    return (
      <StatePanel
        tone="error"
        title="Unable to load dashboard"
        message={error}
        actionLabel="Try again"
        onAction={() => {
          void fetchData()
        }}
        secondaryActionLabel={error.toLowerCase().includes('session expired') ? 'Log out' : undefined}
        onSecondaryAction={error.toLowerCase().includes('session expired') ? clearSessionAndReload : undefined}
      />
    )

  if (!data)
    return (
      <StatePanel
        title="No dashboard data"
        message="There is nothing to show yet. Once data is added, this overview will populate automatically."
        actionLabel="Reload"
        onAction={() => {
          void fetchData()
        }}
      />
    )

  const pipelineStages = data.pipeline.stages.filter((stage) => stage.name !== 'Lost')
  const pipelineTotal = pipelineStages.reduce((sum, stage) => sum + stage.count, 0)
  const todayFollowups = [...data.followupsToday.followups].filter((item) => !item.isDone).sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue))
  const pendingProposals = data.proposals.proposals
    .filter((item) => item.status === 'Draft' || item.status === 'Sent' || item.status === 'Awaiting response')
    .sort((a, b) => new Date(b.sentAt ?? b.createdAt).getTime() - new Date(a.sentAt ?? a.createdAt).getTime())
    .slice(0, 6)

  const statCards = [
    { key: 'leads', label: 'Total leads', value: data.leads.total, trend: `+${metrics.leadsAddedThisWeek} this week` },
    { key: 'clients', label: 'Active clients', value: metrics.activeClients, trend: `${metrics.clientsOnboarding} onboarding` },
    { key: 'proposals', label: 'Open proposals', value: metrics.openProposals, trend: `${metrics.proposalsOverdue} need follow-up` },
    { key: 'followups', label: 'Follow-ups today', value: metrics.followUpsPending, trend: `${data.followupsToday.overdueCount} overdue` },
  ]

  const visibleStatCards = statCards.filter((card) => canView(card.key))

  return (
    <div className="min-h-full space-y-6 bg-[#0a0a0a] px-4 py-5 font-['Geist','IBM_Plex_Sans','DM_Sans',ui-sans-serif,sans-serif] sm:px-6 sm:py-6 lg:space-y-8 lg:px-8 lg:py-7">
      <div className="animate-fadeUp flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" style={animationStyle(0)}>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#404040]">{getGreeting()}</p>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#fafafa]">{userName}</h1>
        </div>

        {visibleQuickActions.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {visibleQuickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onQuickAction?.(action.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-[#71717a] transition-all duration-150 hover:bg-[#1a1a1a] hover:text-[#fafafa]"
              >
                <Plus size={13} />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`animate-fadeUp grid gap-4 ${
          visibleStatCards.length === 4 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
        }`}
        style={animationStyle(60)}
      >
        {visibleStatCards.map((card) => (
          <div key={card.key} className="rounded-2xl bg-[#111111] p-5">
            <p className="text-[13px] font-medium text-[#52525b]">{card.label}</p>
            <p className="mt-3 font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[28px] font-medium leading-none text-[#fafafa]">
              {card.value}
            </p>
            {card.key === 'followups' ? (
              <p className="mt-3 text-[11px] text-[#52525b]">
                <span className="text-[#ef4444]">{card.trend}</span>
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-[#52525b]">{card.trend}</p>
            )}
          </div>
        ))}
      </div>

      {showPipeline && (
        <div className="animate-fadeUp" style={animationStyle(120)}>
          <div className="rounded-2xl bg-[#111111] p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#a1a1aa]">Pipeline</p>
              <p className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                {pipelineTotal} leads
              </p>
            </div>

            <div className="space-y-3">
              {pipelineStages.map((stage) => {
                const pct = pipelineTotal > 0 ? (stage.count / pipelineTotal) * 100 : 0
                return (
                  <div key={stage.name} className="flex items-center gap-4">
                    <p className="w-22 shrink-0 text-[12px] text-[#52525b] sm:w-28">{stage.name}</p>
                    <div className="h-0.75 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                      <div className="h-full rounded-full bg-[#6366f1] transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="w-6 shrink-0 text-right font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[12px] text-[#71717a] sm:w-4">
                      {stage.count}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {(showFollowUps || showActivity || showProposals || showTeam || showFunnel || showUpcoming) && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="animate-fadeUp space-y-6 xl:col-span-3" style={animationStyle(180)}>
            {showFollowUps && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-[#a1a1aa]">Today</p>
                    <span className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                      {todayFollowups.length}
                    </span>
                  </div>
                  <button type="button" className="text-[11px] text-[#52525b] transition-colors hover:text-[#a1a1aa]">
                    View all
                  </button>
                </div>

                <div className="space-y-px">
                  {todayFollowups.map((item) => (
                    <div
                      key={item._id}
                      className="group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[#1a1a1a] sm:gap-4"
                    >
                      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.isOverdue ? 'bg-[#ef4444]' : 'bg-[#3f3f46]'}`} />

                      <p className="flex-1 truncate text-[13px] text-[#a1a1aa] transition-colors group-hover:text-[#fafafa]">
                        {item.businessName}
                      </p>

                      <p className="hidden shrink-0 text-[11px] text-[#52525b] sm:block">{followupTypeLabel(item.type)}</p>
                      <p className="hidden w-14 shrink-0 text-right text-[11px] text-[#52525b] sm:block">{item.assignedTo.name}</p>
                      <button
                        type="button"
                        className="shrink-0 text-[11px] text-[#6366f1] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        Done
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showProposals && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#a1a1aa]">Pending proposals</p>
                  <span className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                    {pendingProposals.length}
                  </span>
                </div>

                <div className="space-y-px">
                  {pendingProposals.map((item) => {
                    const targetBusiness = item.lead?.businessName ?? item.client?.businessName ?? item.title
                    const age = sentDaysAgo(item.sentAt, item.createdAt)
                    return (
                      <div key={item._id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a] sm:gap-4">
                        <p className="flex-1 truncate text-[13px] text-[#a1a1aa] transition-colors group-hover:text-[#fafafa]">{targetBusiness}</p>
                        <p
                          className={`shrink-0 font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] ${
                            age >= 5 ? 'text-[#f59e0b]' : 'text-[#52525b]'
                          }`}
                        >
                          {age}d
                        </p>
                        <p className="hidden shrink-0 font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#71717a] sm:block">
                          {item.status}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {showFunnel && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#a1a1aa]">Conversion funnel</p>
                  <p className="text-[11px] text-[#52525b]">This month</p>
                </div>

                <div className="space-y-3">
                  {pipelineStages.map((stage, index) => {
                    const baseCount = Math.max(pipelineStages[0]?.count ?? 1, 1)
                    const pct = Math.round((stage.count / baseCount) * 100)
                    return (
                      <div key={stage.name} className="flex items-center gap-4">
                        <p className="w-20 shrink-0 text-right text-[11px] text-[#52525b] sm:w-24">{stage.name}</p>
                        <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                          <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="w-8 shrink-0 text-right font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                          {index === 0 ? '100%' : `${pct}%`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="animate-fadeUp space-y-6 xl:col-span-2" style={animationStyle(240)}>
            {showActivity && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#a1a1aa]">Recent activity</p>
                  <button type="button" className="text-[11px] text-[#52525b] transition-colors hover:text-[#a1a1aa]">
                    View all
                  </button>
                </div>

                <div className="space-y-px">
                  {data.activity.activities.slice(0, 8).map((item) => (
                    <div key={item._id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                        <span className="text-[11px] font-medium text-[#52525b]">{item.actor.initials}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-relaxed text-[#71717a]">
                          <span className="text-[#a1a1aa]">{item.actor.name}</span> ·{' '}
                          <span className="text-[#a1a1aa]">{item.targetName}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#52525b]">{item.description}</p>
                        <p className="mt-0.5 text-[11px] text-[#3f3f46]">{formatRelativeTime(item.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showTeam && data.team && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#a1a1aa]">BD team this month</p>
                </div>

                <div className="space-y-px">
                  {[...data.team.members]
                    .sort((a, b) => b.leadsContacted - a.leadsContacted)
                    .slice(0, 5)
                    .map((member, index) => (
                      <div key={member._id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                          <span className="text-[11px] font-medium text-[#71717a]">{member.initials}</span>
                        </div>

                        <p className="flex-1 truncate text-[13px] text-[#a1a1aa]">{member.name}</p>

                        <div className="hidden items-center gap-4 sm:flex">
                          <p className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                            {member.leadsContacted}
                            <span className="text-[#3f3f46]"> leads</span>
                          </p>
                          <p className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                            {member.proposalsSent}
                            <span className="text-[#3f3f46]"> props</span>
                          </p>
                        </div>

                        {index === 0 && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" />}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {showUpcoming && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#a1a1aa]">Upcoming</p>
                  <p className="text-[11px] text-[#52525b]">Next 3 days</p>
                </div>

                <div className="space-y-px">
                  {data.followupsUpcoming.followups
                    .filter((item) => !item.isDone)
                    .slice(0, 6)
                    .map((item) => (
                      <div key={item._id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a] sm:gap-4">
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3f3f46]" />
                        <p className="flex-1 truncate text-[13px] text-[#71717a]">{item.businessName}</p>
                        <p className="hidden shrink-0 text-[11px] text-[#52525b] sm:block">{followupTypeLabel(item.type)}</p>
                        <p className="w-16 shrink-0 text-right font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                          {dueLabel(item.dueAt)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
