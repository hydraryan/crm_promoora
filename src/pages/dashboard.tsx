import { Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { usePermissions } from '@/context/PermissionContext'

interface DashboardPageProps {
  userName: string
}

const mockStats = {
  totalLeads: 24,
  leadsAddedThisWeek: 3,
  activeClients: 3,
  clientsOnboarding: 2,
  openProposals: 7,
  proposalsOverdue: 2,
  followUpsToday: 5,
  followUpsOverdue: 2,
}

const mockPipeline = [
  { stage: 'Cold', count: 8, color: '#525252' },
  { stage: 'Contacted', count: 6, color: '#3b82f6' },
  { stage: 'Meeting', count: 4, color: '#8b5cf6' },
  { stage: 'Proposal sent', count: 3, color: '#f59e0b' },
  { stage: 'Negotiation', count: 2, color: '#f97316' },
  { stage: 'Won', count: 1, color: '#10b981' },
]

const mockTodayFollowUps = [
  { id: 1, business: 'Hotel Spice Garden', owner: 'Rajiv Sharma', type: 'call', assigned: 'Priya', overdue: true },
  { id: 2, business: 'City Bakery', owner: 'Anand Kumar', type: 'whatsapp', assigned: 'Rahul', overdue: true },
  { id: 3, business: 'Tanvi Beauty Salon', owner: 'Tanvi Kapoor', type: 'walk-in', assigned: 'Priya', overdue: false },
  { id: 4, business: 'Sunrise Pharmacy', owner: 'Deepak Jain', type: 'call', assigned: 'Arjun', overdue: false },
  { id: 5, business: 'Gupta Hardware', owner: 'Ramesh Gupta', type: 'whatsapp', assigned: 'Rahul', overdue: false },
]

const mockActivity = [
  { id: 1, actor: 'Priya', initials: 'PA', action: 'added a note on', target: 'Hotel Spice Garden', time: '2h ago', type: 'note' },
  { id: 2, actor: 'Rahul', initials: 'RN', action: 'created a new lead -', target: 'City Bakery', time: '4h ago', type: 'lead' },
  { id: 3, actor: 'Arjun', initials: 'AV', action: 'sent a proposal to', target: 'Dr. Mehta Clinic', time: '5h ago', type: 'proposal' },
  { id: 4, actor: 'Priya', initials: 'PA', action: 'moved', target: 'Tanvi Beauty Salon', time: '1d ago', type: 'status' },
  { id: 5, actor: 'Rahul', initials: 'RN', action: 'completed follow-up -', target: 'Hotel Spice Garden', time: '1d ago', type: 'followup' },
  { id: 6, actor: 'Arjun', initials: 'AV', action: 'created a new lead -', target: 'Sunrise Pharmacy', time: '2d ago', type: 'lead' },
  { id: 7, actor: 'Priya', initials: 'PA', action: 'sent a proposal to', target: 'Gupta Hardware', time: '2d ago', type: 'proposal' },
  { id: 8, actor: 'Rahul', initials: 'RN', action: 'added a note on', target: 'City Bakery', time: '3d ago', type: 'note' },
]

const mockProposals = [
  { id: 1, business: 'Dr. Mehta Clinic', value: '₹18,000', sentDaysAgo: 6, status: 'awaiting' },
  { id: 2, business: 'Tanvi Beauty Salon', value: '₹12,500', sentDaysAgo: 3, status: 'awaiting' },
  { id: 3, business: 'The Dhaba Corner', value: '₹9,000', sentDaysAgo: 8, status: 'overdue' },
  { id: 4, business: 'Gupta Hardware', value: '₹22,000', sentDaysAgo: 1, status: 'sent' },
]

const mockTeam = [
  { name: 'Priya Anand', initials: 'PA', leadsContacted: 12, proposalsSent: 4, followUpsDone: 9, top: true },
  { name: 'Arjun Verma', initials: 'AV', leadsContacted: 9, proposalsSent: 3, followUpsDone: 7, top: false },
  { name: 'Rahul Nair', initials: 'RN', leadsContacted: 7, proposalsSent: 2, followUpsDone: 5, top: false },
]

const mockUpcoming = [
  { id: 1, business: 'The Dhaba Corner', type: 'call', assigned: 'Arjun', dueDate: 'Tomorrow' },
  { id: 2, business: 'Sunrise Pharmacy', type: 'walk-in', assigned: 'Priya', dueDate: 'Tomorrow' },
  { id: 3, business: 'Metro Mobile Shop', type: 'whatsapp', assigned: 'Rahul', dueDate: 'In 2 days' },
  { id: 4, business: 'Kapoor Sweets', type: 'call', assigned: 'Arjun', dueDate: 'In 3 days' },
]

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

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function animationStyle(delayMs: number): CSSProperties {
  return {
    animationDelay: `${delayMs}ms`,
    opacity: 0,
  }
}

function proposalAssignee(id: number): string {
  const assignmentOrder = ['Priya', 'Rahul', 'Arjun']
  return assignmentOrder[(id - 1) % assignmentOrder.length]
}

export default function DashboardPage({ userName }: DashboardPageProps) {
  const { permissions } = usePermissions()

  const canView = (module: string) => Boolean(permissions?.[module]?.view)
  const canCreate = (module: string) => Boolean(permissions?.[module]?.create)

  // Personal scope is applied for creator-level users without team management permissions.
  const shouldUsePersonalScope = !canCreate('team') && (canCreate('leads') || canCreate('followups') || canCreate('proposals'))

  const roleName = normalizeName(userName)
  const pipelineTotal = mockPipeline.reduce((sum, stage) => sum + stage.count, 0)

  const visibleQuickActions = quickActions.filter((action) => canCreate(action.module))

  const statCards = [
    { key: 'leads', label: 'Total leads', value: mockStats.totalLeads, trend: `+${mockStats.leadsAddedThisWeek} this week` },
    { key: 'clients', label: 'Active clients', value: mockStats.activeClients, trend: `${mockStats.clientsOnboarding} onboarding` },
    { key: 'proposals', label: 'Open proposals', value: mockStats.openProposals, trend: `${mockStats.proposalsOverdue} need follow-up` },
    { key: 'followups', label: 'Follow-ups today', value: mockStats.followUpsToday, trend: `${mockStats.followUpsOverdue} overdue` },
  ]

  const visibleStatCards = statCards.filter((card) => canView(card.key))

  const todayFollowUps = shouldUsePersonalScope ? mockTodayFollowUps.filter((item) => normalizeName(item.assigned) === roleName) : mockTodayFollowUps

  const sortedFollowUps = [...todayFollowUps].sort((a, b) => Number(b.overdue) - Number(a.overdue))

  const showActivity = canView('team') && (canCreate('leads') || canCreate('followups') || canCreate('proposals'))
  const visibleActivity = showActivity
    ? shouldUsePersonalScope
      ? mockActivity.filter((item) => normalizeName(item.actor) === roleName)
      : mockActivity
    : []

  const showProposals = canView('proposals') && canCreate('proposals')
  const visibleProposals = showProposals
    ? shouldUsePersonalScope
      ? mockProposals.filter((proposal) => normalizeName(proposalAssignee(proposal.id)) === roleName)
      : mockProposals
    : []

  const showFollowUps = canView('followups') && canCreate('followups')
  const visibleUpcoming = showFollowUps
    ? shouldUsePersonalScope
      ? mockUpcoming.filter((item) => normalizeName(item.assigned) === roleName)
      : mockUpcoming
    : []

  const showPipeline = canView('leads')
  const showTeam = canView('team') && canCreate('team')
  const showFunnel = canView('leads') && canView('proposals')
  const showUpcoming = showFollowUps

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
          visibleStatCards.length === 4 ? 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
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
              {mockPipeline.map((stage) => {
                const pct = (stage.count / pipelineTotal) * 100
                return (
                  <div key={stage.stage} className="flex items-center gap-4">
                    <p className="w-22 shrink-0 text-[12px] text-[#52525b] sm:w-28">{stage.stage}</p>
                    <div className="h-0.75 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                      <div
                        className="h-full rounded-full bg-[#6366f1] transition-all duration-700"
                        style={{ width: `${pct}%`, opacity: 0.3 + (stage.count / pipelineTotal) * 0.7 }}
                      />
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
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
          <div className="animate-fadeUp space-y-6 2xl:col-span-3" style={animationStyle(180)}>
            {showFollowUps && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-[#a1a1aa]">Today</p>
                    <span className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                      {sortedFollowUps.length}
                    </span>
                  </div>
                  <button type="button" className="text-[11px] text-[#52525b] transition-colors hover:text-[#a1a1aa]">
                    View all
                  </button>
                </div>

                <div className="space-y-px">
                  {sortedFollowUps.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[#1a1a1a] sm:gap-4"
                    >
                      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.overdue ? 'bg-[#ef4444]' : 'bg-[#3f3f46]'}`} />

                      <p className="flex-1 truncate text-[13px] text-[#a1a1aa] transition-colors group-hover:text-[#fafafa]">
                        {item.business}
                      </p>

                      <p className="hidden shrink-0 text-[11px] text-[#52525b] sm:block">{item.type}</p>
                      <p className="hidden w-12 shrink-0 text-right text-[11px] text-[#52525b] sm:block">{item.assigned}</p>
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
                    {visibleProposals.length}
                  </span>
                </div>

                <div className="space-y-px">
                  {visibleProposals.map((item) => (
                    <div key={item.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a] sm:gap-4">
                      <p className="flex-1 truncate text-[13px] text-[#a1a1aa] transition-colors group-hover:text-[#fafafa]">
                        {item.business}
                      </p>

                      <p
                        className={`shrink-0 font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] ${
                          item.sentDaysAgo >= 5 ? 'text-[#f59e0b]' : 'text-[#52525b]'
                        }`}
                      >
                        {item.sentDaysAgo}d
                      </p>

                      <p className="hidden shrink-0 font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[12px] text-[#71717a] sm:block">
                        {item.value}
                      </p>
                    </div>
                  ))}
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
                  {mockPipeline.map((stage, index) => {
                    const pct = Math.round((stage.count / mockPipeline[0].count) * 100)
                    return (
                      <div key={stage.stage} className="flex items-center gap-4">
                        <p className="w-20 shrink-0 text-right text-[11px] text-[#52525b] sm:w-24">{stage.stage}</p>
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

          <div className="animate-fadeUp space-y-6 2xl:col-span-2" style={animationStyle(240)}>
            {showActivity && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#a1a1aa]">Recent activity</p>
                  <button type="button" className="text-[11px] text-[#52525b] transition-colors hover:text-[#a1a1aa]">
                    View all
                  </button>
                </div>

                <div className="space-y-px">
                  {visibleActivity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                        <span className="text-[11px] font-medium text-[#52525b]">{item.initials}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-relaxed text-[#71717a]">
                          <span className="text-[#a1a1aa]">{item.actor}</span> {item.action}{' '}
                          <span className="text-[#a1a1aa]">{item.target}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#3f3f46]">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showTeam && (
              <div className="rounded-2xl bg-[#111111] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#a1a1aa]">BD team this month</p>
                </div>

                <div className="space-y-px">
                  {mockTeam.map((member) => (
                    <div key={member.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                        <span className="text-[11px] font-medium text-[#71717a]">{member.initials}</span>
                      </div>

                      <p className="flex-1 truncate text-[13px] text-[#a1a1aa]">{member.name}</p>

                      <div className="hidden items-center gap-4 sm:flex">
                        <p className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                          {member.leadsContacted}<span className="text-[#3f3f46]"> leads</span>
                        </p>
                        <p className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                          {member.proposalsSent}<span className="text-[#3f3f46]"> props</span>
                        </p>
                      </div>

                      <p className="font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b] sm:hidden">
                        {member.leadsContacted}L
                      </p>

                      {member.top && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" />}
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
                  {visibleUpcoming.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a] sm:gap-4">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3f3f46]" />
                      <p className="flex-1 truncate text-[13px] text-[#71717a]">{item.business}</p>
                      <p className="hidden shrink-0 text-[11px] text-[#52525b] sm:block">{item.type}</p>
                      <p className="w-16 shrink-0 text-right font-['Geist_Mono','IBM_Plex_Mono','DM_Mono',ui-monospace,monospace] text-[11px] text-[#52525b]">
                        {item.dueDate}
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
