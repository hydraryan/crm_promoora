import { useEffect, useState } from 'react'
import { CRMHeader } from '@/components/ui/crm-header'
import { PromoosaSidebar } from '@/components/ui/promoora-sidebar'
import { PermissionProvider } from '@/context/PermissionContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { LoadingProvider } from '@/context/LoadingContext'
import { usePermissions } from '@/context/PermissionContext'
import { GlobalLoadingBar } from '@/components/ui/loading-bar'
import { apiFetch } from '@/utils/apiFetch'
import DemoOne from './demo'
import DashboardPage from './pages/dashboard.tsx'
import PipelineSummary from './pages/dashboard/PipelineSummary'
import TodayActivity from './pages/dashboard/TodayActivity'
import MyPerformance from './pages/dashboard/MyPerformance'
import LeadFunnelView from './pages/dashboard/LeadFunnelView'
import ConversionReport from './pages/dashboard/ConversionReport'
import AllLeads from './pages/leads/AllLeads'
import OverdueFollowups from './pages/leads/OverdueFollowups'
import AllClients from './pages/clients/AllClients'
import AllProjects from './pages/projects/AllProjects'
import AllFollowups from './pages/followups/AllFollowups'
import AllProposals from './pages/proposals/AllProposals'
import AllInvoices from './pages/invoicing/AllInvoices'
import CommLog from './pages/communication/CommLog'
import LeadConversion from './pages/reports/LeadConversion'
import PipelineReportPage from './pages/reports/PipelineReport'
import RevenueSummary from './pages/reports/RevenueSummary'
import BDPerformance from './pages/reports/BDPerformance'
import FollowupCompletion from './pages/reports/FollowupCompletion'
import ProfileSettings from './pages/settings/ProfileSettings'
import ChangePassword from './pages/settings/ChangePassword'
import ManageRoles from './pages/settings/ManageRoles'
import InviteMembers from './pages/settings/InviteMembers'
import TeamList from './pages/team/TeamList'
import MemberProfile from './pages/team/MemberProfile'
import WorkloadOverview from './pages/team/WorkloadOverview'
import AttendanceLog from './pages/team/AttendanceLog'
import type { PipelineStage } from './utils/leadConstants'
import type { BusinessType } from './utils/clientConstants'
import type { ProjectStatus, ServiceType } from './utils/projectConstants'
import type { ProposalStatus } from './utils/proposalConstants'
import type { Role } from './utils/teamConstants'
import { commViewMap } from './utils/commConstants'

const SESSION_KEY = 'crm_portal_secure_session'

function ProtectedDashboard({ onLogout }: { onLogout: () => void }) {
  const { permissions } = usePermissions()
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [activeItemId, setActiveItemId] = useState('dashboard-overview')

  const storedUser = (() => {
    const raw = localStorage.getItem('crm_user') ?? localStorage.getItem('user')
    if (!raw) {
      console.log('📭 No stored user found in localStorage')
      return null
    }
    try {
      const parsed = JSON.parse(raw)
      // Validate that parsed object has required fields
      if (!parsed.name || !parsed.role) {
        console.warn('⚠️ Stored user missing required fields:', { name: parsed.name, role: parsed.role })
        return null
      }
      console.log('✅ Loaded user from localStorage:', { name: parsed.name, role: parsed.role })
      return parsed as {
        _id?: string
        id?: string
        name?: string
        role?: Role
      }
    } catch (err) {
      console.error('❌ Failed to parse stored user:', err)
      return null
    }
  })()

  const userName = storedUser?.name ?? 'Aryan Singh'
  const role = (storedUser?.role ?? 'admin') as Role
  const canCreateTeamMembers = Boolean(permissions?.team?.create)
  const canViewSettings = Boolean(permissions?.settings?.view)
  const firstName = userName.split(' ')[0] ?? 'Aryan'
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const sectionDefaults: Record<string, string> = {
    dashboard: 'dashboard-overview',
    leads: 'leads/all',
    clients: 'clients/all',
    projects: 'projects/all',
    followups: 'followups/today',
    proposals: 'proposals/all',
    invoicing: 'invoicing/all',
    team: 'team/all',
    communication: 'comm/all',
    reports: 'reports/lead-conversion',
    settings: canViewSettings ? 'settings/profile' : 'settings/password',
  }

  const clientTypeViewMap: Record<string, { defaultBusinessType: BusinessType; titleOverride: string }> = {
    'clients/type/restaurant': { defaultBusinessType: 'Restaurant', titleOverride: 'Restaurants' },
    'clients/type/clinic': { defaultBusinessType: 'Clinic', titleOverride: 'Clinics' },
    'clients/type/salon': { defaultBusinessType: 'Salon', titleOverride: 'Salons' },
    'clients/type/shop-retail': { defaultBusinessType: 'Shop & retail', titleOverride: 'Shops & retail' },
  }

  const stageFromItem = (itemId: string): PipelineStage | undefined => {
    const map: Record<string, PipelineStage> = {
      'leads/stage/cold': 'Cold',
      'leads/stage/contacted': 'Contacted',
      'leads/stage/meeting-scheduled': 'Meeting scheduled',
      'leads/stage/proposal-sent': 'Proposal sent',
      'leads/stage/negotiation': 'Negotiation',
      'leads/stage/won': 'Won',
      'leads/stage/lost': 'Lost',
    }
    return map[itemId]
  }

  const projectStatusViewMap: Record<string, ProjectStatus> = {
    'projects/in-progress': 'In progress',
    'projects/under-review': 'Under review',
    'projects/completed': 'Completed',
    'projects/on-hold': 'On hold',
  }

  const projectServiceViewMap: Record<string, { defaultServiceType: ServiceType; titleOverride: string }> = {
    'projects/type/website': { defaultServiceType: 'Website build', titleOverride: 'Website builds' },
    'projects/type/automation': { defaultServiceType: 'Automation tools', titleOverride: 'Automation tools' },
    'projects/type/uiux': { defaultServiceType: 'UI/UX design', titleOverride: 'UI/UX design' },
  }

  const followupsTypeViewMap: Record<string, { defaultType: 'Phone call' | 'Walk-in' | 'WhatsApp'; titleOverride: string }> = {
    'followups/type/call': { defaultType: 'Phone call', titleOverride: 'Phone calls' },
    'followups/type/walkin': { defaultType: 'Walk-in', titleOverride: 'Walk-ins' },
    'followups/type/whatsapp': { defaultType: 'WhatsApp', titleOverride: 'WhatsApp messages' },
  }

  const proposalsStatusViewMap: Record<string, { defaultStatus?: ProposalStatus; titleOverride: string }> = {
    'proposals/all': { titleOverride: 'All proposals' },
    'proposals/draft': { defaultStatus: 'Draft', titleOverride: 'Draft' },
    'proposals/sent': { defaultStatus: 'Sent', titleOverride: 'Sent' },
    'proposals/awaiting': { defaultStatus: 'Awaiting response', titleOverride: 'Awaiting response' },
    'proposals/accepted': { defaultStatus: 'Accepted', titleOverride: 'Accepted' },
    'proposals/rejected': { defaultStatus: 'Rejected', titleOverride: 'Rejected' },
  }

  const isInvoicingView = (itemId: string) => itemId.startsWith('invoicing/')
  const isTeamMemberView = (itemId: string) => itemId.startsWith('team/member/')

  useEffect(() => {
    const idleThresholdMs = 60_000
    const engagementFlushThresholdMs = 10_000
    let lastInteractionAt = Date.now()
    let lastTickAt = Date.now()
    let pendingActiveMs = 0
    let isWindowFocused = document.hasFocus()

    const markInteraction = () => {
      lastInteractionAt = Date.now()
    }

    const onFocus = () => {
      isWindowFocused = true
      markInteraction()
    }

    const onBlur = () => {
      isWindowFocused = false
    }

    const tick = () => {
      const now = Date.now()
      const elapsedMs = now - lastTickAt
      lastTickAt = now

      const isVisible = !document.hidden
      const isActive = isVisible && isWindowFocused && now - lastInteractionAt <= idleThresholdMs

      if (isActive && elapsedMs > 0) {
        pendingActiveMs += elapsedMs
      }

      if (pendingActiveMs >= engagementFlushThresholdMs) {
        const payloadMs = Math.floor(pendingActiveMs)
        pendingActiveMs = 0

        void apiFetch('/team/attendance/engagement', {
          method: 'POST',
          body: JSON.stringify({ activeMs: payloadMs }),
        }).catch(() => {
          // Keep UX non-blocking if engagement heartbeat fails.
        })
      }
    }

    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    for (const eventName of events) {
      window.addEventListener(eventName, markInteraction, { passive: true })
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', markInteraction)

    const interval = window.setInterval(tick, 5_000)

    return () => {
      window.clearInterval(interval)
      for (const eventName of events) {
        window.removeEventListener(eventName, markInteraction)
      }
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', markInteraction)
    }
  }, [])

  const renderMainContent = () => {
    if (activeSection === 'dashboard') {
      switch (activeItemId) {
        case 'pipeline-summary':
          return <PipelineSummary />
        case 'todays-activity':
          return <TodayActivity />
        case 'my-performance':
          return <MyPerformance />
        case 'lead-funnel-view':
          return <LeadFunnelView />
        case 'conversion-report':
          return <ConversionReport />
        default:
          return (
            <DashboardPage
              userName={firstName}
              onQuickAction={(actionId) => {
                if (actionId === 'lead') {
                  setActiveSection('leads')
                  setActiveItemId('leads/new')
                  return
                }

                if (actionId === 'client') {
                  setActiveSection('clients')
                  setActiveItemId('clients/new')
                  return
                }

                if (actionId === 'proposal') {
                  setActiveSection('proposals')
                  setActiveItemId('proposals/new')
                  return
                }

                setActiveSection('followups')
                setActiveItemId('followups/today')
              }}
            />
          )
      }
    }

    if (activeSection === 'leads') {
      if (activeItemId === 'leads/overdue') {
        return <OverdueFollowups />
      }

      if (activeItemId === 'leads/mine') {
        const userId = storedUser?._id ?? storedUser?.id ?? ''
        return <AllLeads defaultAssignedTo={userId} mineOnly titleOverride="Assigned to me" />
      }

      if (activeItemId === 'leads/new') {
        return <AllLeads openNewLeadModal />
      }

      if (activeItemId === 'leads/import') {
        return <AllLeads openImportModal />
      }

      const stage = stageFromItem(activeItemId)
      if (stage) {
        return <AllLeads defaultStage={stage} />
      }

      return <AllLeads />
    }

    if (activeSection === 'clients') {
      if (activeItemId === 'clients/new') {
        return <AllClients openNewClientModal />
      }

      if (activeItemId === 'clients/active') {
        return <AllClients defaultStatus="Active" titleOverride="Active clients" />
      }

      if (activeItemId === 'clients/onboarding') {
        return <AllClients defaultStatus="Onboarding" titleOverride="Onboarding" />
      }

      if (activeItemId === 'clients/inactive') {
        return <AllClients defaultStatus="Inactive" titleOverride="Inactive" />
      }

      const typeView = clientTypeViewMap[activeItemId]
      if (typeView) {
        return <AllClients defaultBusinessType={typeView.defaultBusinessType} titleOverride={typeView.titleOverride} />
      }

      return <AllClients />
    }

    if (activeSection === 'projects') {
      if (activeItemId === 'projects/new') {
        return <AllProjects openNewProjectModal />
      }

      const statusView = projectStatusViewMap[activeItemId]
      if (statusView) {
        return <AllProjects defaultStatus={statusView} titleOverride={statusView} />
      }

      const serviceView = projectServiceViewMap[activeItemId]
      if (serviceView) {
        return <AllProjects defaultServiceType={serviceView.defaultServiceType} titleOverride={serviceView.titleOverride} />
      }

      return <AllProjects />
    }

    if (activeSection === 'followups') {
      if (activeItemId === 'followups/overdue') {
        return <AllFollowups defaultView="overdue" titleOverride="Overdue follow-ups" />
      }

      if (activeItemId === 'followups/today') {
        return <AllFollowups defaultView="today" titleOverride="Due today" />
      }

      if (activeItemId === 'followups/upcoming') {
        return <AllFollowups defaultView="upcoming" titleOverride="Upcoming follow-ups" />
      }

      const followupTypeView = followupsTypeViewMap[activeItemId]
      if (followupTypeView) {
        return <AllFollowups defaultType={followupTypeView.defaultType} titleOverride={followupTypeView.titleOverride} />
      }

      if (activeItemId === 'followups/mine') {
        return <AllFollowups defaultAssignedToMe titleOverride="My follow-ups" />
      }

      return <AllFollowups titleOverride="All follow-ups" />
    }

    if (activeSection === 'proposals') {
      if (activeItemId === 'proposals/new') {
        return <AllProposals titleOverride="All proposals" openBuilderOnMount />
      }

      const proposalView = proposalsStatusViewMap[activeItemId] ?? proposalsStatusViewMap['proposals/all']
      return <AllProposals defaultStatus={proposalView.defaultStatus} titleOverride={proposalView.titleOverride} />
    }

    if (activeSection === 'invoicing') {
      const viewId = isInvoicingView(activeItemId) ? activeItemId : 'invoicing/all'
      return <AllInvoices role={role} viewId={viewId} />
    }

    if (activeSection === 'team') {
      const currentUserId = storedUser?._id ?? storedUser?.id ?? ''

      if (isTeamMemberView(activeItemId)) {
        const memberId = activeItemId.replace('team/member/', '')
        return <MemberProfile role={role} currentUserId={currentUserId} memberId={memberId} onBack={() => setActiveItemId('team/all')} />
      }

      if (activeItemId === 'team/workload') {
        return <WorkloadOverview role={role} currentUserId={currentUserId} onOpenMember={(memberId) => setActiveItemId(`team/member/${memberId}`)} />
      }

      if (activeItemId === 'team/attendance') {
        return <AttendanceLog role={role} currentUserId={currentUserId} onOpenMember={(memberId) => setActiveItemId(`team/member/${memberId}`)} />
      }

      if (activeItemId === 'team/bd') {
        return <TeamList role={role} currentUserId={currentUserId} defaultRole="bd_intern" titleOverride="BD interns" onOpenMember={(memberId) => setActiveItemId(`team/member/${memberId}`)} />
      }

      if (activeItemId === 'team/tech') {
        return <TeamList role={role} currentUserId={currentUserId} defaultRole="tech_intern" titleOverride="Tech interns" onOpenMember={(memberId) => setActiveItemId(`team/member/${memberId}`)} />
      }

      if (activeItemId === 'team/admin') {
        return <TeamList role={role} currentUserId={currentUserId} defaultRole="admin" titleOverride="Admins" onOpenMember={(memberId) => setActiveItemId(`team/member/${memberId}`)} />
      }

      if (activeItemId === 'team/add' && canCreateTeamMembers) {
        return <TeamList role={role} currentUserId={currentUserId} openAddModal titleOverride="All members" onOpenMember={(memberId) => setActiveItemId(`team/member/${memberId}`)} />
      }

      return <TeamList role={role} currentUserId={currentUserId} titleOverride="All members" onOpenMember={(memberId) => setActiveItemId(`team/member/${memberId}`)} />
    }

    if (activeSection === 'communication') {
      const currentUserId = storedUser?._id ?? storedUser?.id ?? ''
      const mappedView = commViewMap[activeItemId]

      if (mappedView) {
        return (
          <CommLog
            role={role}
            userId={currentUserId}
            defaultChannel={mappedView.defaultChannel}
            groupBy={mappedView.groupBy}
            titleOverride={mappedView.titleOverride}
          />
        )
      }

      return <CommLog role={role} userId={currentUserId} titleOverride="All communications" />
    }

    if (activeSection === 'reports') {
      if (activeItemId === 'reports/pipeline') {
        return <PipelineReportPage role={role} />
      }

      if (activeItemId === 'reports/revenue') {
        return <RevenueSummary role={role} />
      }

      if (activeItemId === 'reports/bd-performance') {
        return <BDPerformance role={role} />
      }

      if (activeItemId === 'reports/followup-completion') {
        return <FollowupCompletion role={role} />
      }

      return <LeadConversion role={role} />
    }

    if (activeSection === 'settings') {
      if (activeItemId === 'settings/profile') {
        return <ProfileSettings role={role} />
      }

      if (activeItemId === 'settings/roles') {
        return <ManageRoles role={role} />
      }

      if (activeItemId === 'settings/invite') {
        return <InviteMembers role={role} />
      }

      return <ChangePassword />
    }

    return (
      <div className="min-h-full rounded-2xl bg-[#111111] p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#404040]">{activeSection}</p>
        <h2 className="mt-2 text-[22px] font-semibold text-[#fafafa]">Module workspace</h2>
        <p className="mt-2 text-sm text-[#52525b]">This module view will be expanded next.</p>
      </div>
    )
  }

  const handleNotificationNavigate = (actionUrl?: string) => {
    if (!actionUrl) return

    const normalized = actionUrl.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').toLowerCase()
    if (!normalized) return

    const aliases: Record<string, string> = {
      dashboard: 'dashboard-overview',
      'team/list': 'team/all',
    }

    const targetItemId = aliases[normalized] ?? normalized
    const targetSection = targetItemId.split('/')[0]

    if (!targetSection) return

    setActiveSection(targetSection)
    setActiveItemId(targetItemId)
  }

  return (
    <main className="dashboard-theme flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground transition-colors duration-300">
      <GlobalLoadingBar />
      <CRMHeader
        isDetailCollapsed={isDetailCollapsed}
        onToggleCollapse={() => setIsDetailCollapsed((prev) => !prev)}
        onLogoClick={() => {
          setActiveSection('dashboard')
          setActiveItemId('dashboard-overview')
        }}
        activeSection={activeSection}
        userName={userName}
        userInitials={initials}
        role={role}
        onSearchNavigate={handleNotificationNavigate}
        onNotificationNavigate={handleNotificationNavigate}
        onViewProfile={() => {
          const currentUserId = storedUser?._id ?? storedUser?.id
          setActiveSection('team')
          setActiveItemId(currentUserId ? `team/member/${currentUserId}` : 'team/all')
        }}
        onSignOut={onLogout}
      />
      <div className="flex flex-1 overflow-hidden pt-14">
        <PromoosaSidebar
          role={role}
          activeSection={activeSection}
          onSectionChange={(section) => {
            setActiveSection(section)
            if (section === 'settings') {
              setActiveItemId(canViewSettings ? 'settings/profile' : 'settings/password')
            } else {
              setActiveItemId(sectionDefaults[section] ?? `${section}-overview`)
            }
          }}
          isDetailCollapsed={isDetailCollapsed}
          activeItemId={activeItemId}
          onItemSelect={(itemId, section) => {
            setActiveSection(section)
            setActiveItemId(itemId)
          }}
        />
        <main className="flex-1 overflow-y-auto bg-background p-6 transition-colors duration-300">{renderMainContent()}</main>
      </div>
    </main>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const hasSession = sessionStorage.getItem(SESSION_KEY) === 'authenticated'
    const hasToken = Boolean(localStorage.getItem('crm_access_token') ?? localStorage.getItem('accessToken'))
    return hasSession && hasToken
  })

  useEffect(() => {
    if (!isAuthenticated) {
      document.documentElement.classList.remove('light')
    }
  }, [isAuthenticated])

  const handleAuthenticated = () => {
    sessionStorage.setItem(SESSION_KEY, 'authenticated')
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setIsAuthenticated(false)
  }

  if (isAuthenticated) {
    return (
      <ThemeProvider>
        <LoadingProvider>
          <PermissionProvider>
            <ProtectedDashboard onLogout={handleLogout} />
          </PermissionProvider>
        </LoadingProvider>
      </ThemeProvider>
    )
  }

  return <DemoOne onAuthenticated={handleAuthenticated} />
}

export default App
