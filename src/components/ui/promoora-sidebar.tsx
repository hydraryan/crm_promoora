import { useEffect, useMemo, useState } from 'react'
import { usePermissions } from '@/context/PermissionContext'
import {
  AlertCircle,
  BarChart2,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CalendarCheck,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Circle,
  Clock,
  Code2,
  Cpu,
  DollarSign,
  Eye,
  FileEdit,
  FileText,
  Filter,
  Globe,
  Layers,
  LayoutDashboard,
  List,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  MinusCircle,
  Palette,
  PauseCircle,
  Phone,
  PhoneCall,
  Plus,
  Receipt,
  Repeat2,
  Scissors,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  TrendingUp,
  Upload,
  UserCircle,
  UserPlus,
  Users,
  Utensils,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

type UserRole = 'admin' | 'bd_intern' | 'tech_intern' | 'viewer'

type SectionKey =
  | 'dashboard'
  | 'leads'
  | 'clients'
  | 'projects'
  | 'followups'
  | 'proposals'
  | 'invoicing'
  | 'team'
  | 'communication'
  | 'reports'
  | 'settings'

interface MenuItem {
  id: string
  label: string
  icon: LucideIcon
  subItems?: Array<{ id: string; label: string }>
}

interface MenuGroup {
  id: string
  label: string
  items: MenuItem[]
}

interface SectionConfig {
  title: string
  icon: LucideIcon
  groups: MenuGroup[]
}

export interface PromoosaSidebarProps {
  role: UserRole
  activeSection: string
  onSectionChange: (section: string) => void
  isDetailCollapsed: boolean
  activeItemId?: string
  onItemSelect?: (itemId: string, section: string) => void
}

const ICON_RAIL_ORDER: SectionKey[] = [
  'dashboard',
  'leads',
  'clients',
  'projects',
  'followups',
  'proposals',
  'invoicing',
  'team',
  'communication',
  'reports',
]

const ROLE_SECTION_ACCESS: Record<UserRole, Record<SectionKey, boolean>> = {
  admin: {
    dashboard: true,
    leads: true,
    clients: true,
    projects: true,
    followups: true,
    proposals: true,
    invoicing: true,
    team: true,
    communication: true,
    reports: true,
    settings: true,
  },
  bd_intern: {
    dashboard: true,
    leads: true,
    clients: true,
    projects: true,
    followups: true,
    proposals: true,
    invoicing: true,
    team: true,
    communication: true,
    reports: false,
    settings: true,
  },
  tech_intern: {
    dashboard: true,
    leads: false,
    clients: true,
    projects: true,
    followups: false,
    proposals: false,
    invoicing: false,
    team: true,
    communication: false,
    reports: false,
    settings: true,
  },
  viewer: {
    dashboard: true,
    leads: true,
    clients: true,
    projects: false,
    followups: false,
    proposals: false,
    invoicing: false,
    team: true,
    communication: false,
    reports: false,
    settings: true,
  },
}

const SECTION_CONFIG: Record<SectionKey, SectionConfig> = {
  dashboard: {
    title: 'Dashboard',
    icon: LayoutDashboard,
    groups: [
      {
        id: 'dashboard-overview',
        label: 'Overview',
        items: [
          { id: 'pipeline-summary', label: 'Pipeline summary', icon: BarChart2 },
          { id: 'todays-activity', label: "Today's activity", icon: CalendarCheck },
          { id: 'my-performance', label: 'My performance', icon: UserCircle },
        ],
      },
      {
        id: 'dashboard-views',
        label: 'Views',
        items: [
          { id: 'lead-funnel-view', label: 'Lead funnel view', icon: Filter },
          { id: 'conversion-report', label: 'Conversion report', icon: BarChart2 },
        ],
      },
    ],
  },
  leads: {
    title: 'Leads',
    icon: Filter,
    groups: [
      {
        id: 'leads-quick',
        label: 'Quick Actions',
        items: [
          { id: 'leads/new', label: 'Add new lead', icon: Plus },
          { id: 'leads/import', label: 'Import leads', icon: Upload },
        ],
      },
      {
        id: 'leads-stages',
        label: 'Pipeline Stages',
        items: [
          { id: 'leads/stage/cold', label: 'Cold', icon: Circle },
          { id: 'leads/stage/contacted', label: 'Contacted', icon: PhoneCall },
          { id: 'leads/stage/meeting-scheduled', label: 'Meeting scheduled', icon: CalendarClock },
          { id: 'leads/stage/proposal-sent', label: 'Proposal sent', icon: FileText },
          { id: 'leads/stage/negotiation', label: 'Negotiation', icon: Repeat2 },
          { id: 'leads/stage/won', label: 'Won', icon: CheckCircle },
          { id: 'leads/stage/lost', label: 'Lost', icon: XCircle },
        ],
      },
      {
        id: 'leads-filters',
        label: 'Filters',
        items: [
          { id: 'leads/mine', label: 'Assigned to me', icon: UserCircle },
          { id: 'leads/all', label: 'All leads', icon: List },
          { id: 'leads/overdue', label: 'Overdue follow-ups', icon: Clock },
        ],
      },
    ],
  },
  clients: {
    title: 'Clients',
    icon: Building2,
    groups: [
      {
        id: 'clients-quick',
        label: 'Quick Actions',
        items: [{ id: 'clients/new', label: 'Add new client', icon: Plus }],
      },
      {
        id: 'clients-status',
        label: 'Status',
        items: [
          { id: 'clients/active', label: 'Active clients', icon: CheckCircle2 },
          { id: 'clients/onboarding', label: 'Onboarding', icon: Layers },
          { id: 'clients/inactive', label: 'Inactive', icon: MinusCircle },
        ],
      },
      {
        id: 'clients-types',
        label: 'Business Types',
        items: [
          { id: 'clients/type/restaurant', label: 'Restaurants', icon: Utensils },
          { id: 'clients/type/clinic', label: 'Clinics', icon: Stethoscope },
          { id: 'clients/type/salon', label: 'Salons', icon: Scissors },
          { id: 'clients/type/shop-retail', label: 'Shops & retail', icon: ShoppingBag },
        ],
      },
    ],
  },
  projects: {
    title: 'Projects',
    icon: Layers,
    groups: [
      {
        id: 'projects-quick',
        label: 'Quick Actions',
        items: [{ id: 'projects/new', label: 'New project', icon: Plus }],
      },
      {
        id: 'projects-status',
        label: 'Status',
        items: [
          { id: 'projects/in-progress', label: 'In progress', icon: Loader2 },
          { id: 'projects/under-review', label: 'Under review', icon: Eye },
          { id: 'projects/completed', label: 'Completed', icon: CheckCircle2 },
          { id: 'projects/on-hold', label: 'On hold', icon: PauseCircle },
        ],
      },
      {
        id: 'projects-service',
        label: 'Service Type',
        items: [
          { id: 'projects/type/website', label: 'Website builds', icon: Globe },
          { id: 'projects/type/automation', label: 'Automation tools', icon: Cpu },
          { id: 'projects/type/uiux', label: 'UI/UX design', icon: Palette },
        ],
      },
    ],
  },
  followups: {
    title: 'Follow-ups',
    icon: CalendarCheck,
    groups: [
      {
        id: 'followups-today',
        label: 'Today',
        items: [
          { id: 'followups/overdue', label: 'Overdue', icon: AlertCircle },
          { id: 'followups/today', label: 'Due today', icon: Clock },
          { id: 'followups/upcoming', label: 'Upcoming', icon: CalendarCheck },
        ],
      },
      {
        id: 'followups-type',
        label: 'Type',
        items: [
          { id: 'followups/type/call', label: 'Phone calls', icon: Phone },
          { id: 'followups/type/walkin', label: 'Walk-ins', icon: MapPin },
          { id: 'followups/type/whatsapp', label: 'WhatsApp messages', icon: MessageSquare },
        ],
      },
      {
        id: 'followups-assignment',
        label: 'Assignment',
        items: [
          { id: 'followups/mine', label: 'My follow-ups', icon: UserCircle },
          { id: 'followups/all', label: 'All follow-ups', icon: Users },
        ],
      },
    ],
  },
  proposals: {
    title: 'Proposals',
    icon: FileText,
    groups: [
      {
        id: 'proposals-quick',
        label: 'Quick Actions',
        items: [{ id: 'proposals/new', label: 'Create proposal', icon: Plus }],
      },
      {
        id: 'proposals-status',
        label: 'Status',
        items: [
          { id: 'proposals/draft', label: 'Draft', icon: FileEdit },
          { id: 'proposals/sent', label: 'Sent', icon: Send },
          { id: 'proposals/awaiting', label: 'Awaiting response', icon: Clock },
          { id: 'proposals/accepted', label: 'Accepted', icon: CheckCircle2 },
          { id: 'proposals/rejected', label: 'Rejected', icon: XCircle },
        ],
      },
    ],
  },
  invoicing: {
    title: 'Invoicing',
    icon: Receipt,
    groups: [
      {
        id: 'invoicing-quick',
        label: 'Quick Actions',
        items: [{ id: 'invoicing/new', label: 'New invoice', icon: Plus }],
      },
      {
        id: 'invoicing-status',
        label: 'Status',
        items: [
          { id: 'invoicing/unpaid', label: 'Unpaid', icon: AlertCircle },
          { id: 'invoicing/paid', label: 'Paid', icon: CheckCircle },
          { id: 'invoicing/overdue', label: 'Overdue', icon: XCircle },
          { id: 'invoicing/all', label: 'All invoices', icon: List },
        ],
      },
    ],
  },
  team: {
    title: 'Team',
    icon: Users,
    groups: [
      {
        id: 'team-quick',
        label: 'Quick Actions',
        items: [{ id: 'team/add', label: 'Add member', icon: UserPlus }],
      },
      {
        id: 'team-roles',
        label: 'Roles',
        items: [
          { id: 'team/bd', label: 'BD interns', icon: Briefcase },
          { id: 'team/tech', label: 'Tech interns', icon: Code2 },
          { id: 'team/admin', label: 'Admins', icon: ShieldCheck },
        ],
      },
      {
        id: 'team-views',
        label: 'Views',
        items: [
          { id: 'team/workload', label: 'Workload overview', icon: BarChart2 },
          { id: 'team/attendance', label: 'Attendance log', icon: CalendarCheck },
        ],
      },
    ],
  },
  communication: {
    title: 'Communication',
    icon: MessageSquare,
    groups: [
      {
        id: 'communication-channels',
        label: 'Channels',
        items: [
          { id: 'comm/whatsapp', label: 'WhatsApp log', icon: MessageSquare },
          { id: 'comm/email', label: 'Email log', icon: Mail },
          { id: 'comm/calls', label: 'Call log', icon: Phone },
        ],
      },
      {
        id: 'communication-filters',
        label: 'Filters',
        items: [
          { id: 'comm/by-client', label: 'By client', icon: Building2 },
          { id: 'comm/by-member', label: 'By team member', icon: UserCircle },
          { id: 'comm/by-date', label: 'By date', icon: Calendar },
        ],
      },
    ],
  },
  reports: {
    title: 'Reports',
    icon: BarChart2,
    groups: [
      {
        id: 'reports-sales',
        label: 'Sales',
        items: [
          { id: 'reports/lead-conversion', label: 'Lead conversion', icon: TrendingUp },
          { id: 'reports/pipeline', label: 'Pipeline report', icon: Filter },
          { id: 'reports/revenue', label: 'Revenue summary', icon: DollarSign },
        ],
      },
      {
        id: 'reports-team',
        label: 'Team',
        items: [
          { id: 'reports/bd-performance', label: 'BD performance', icon: BarChart2 },
          { id: 'reports/followup-completion', label: 'Follow-up completion', icon: CheckSquare },
        ],
      },
    ],
  },
  settings: {
    title: 'Settings',
    icon: Settings,
    groups: [
      {
        id: 'settings-account',
        label: 'Account',
        items: [
          { id: 'settings/profile', label: 'Profile', icon: UserCircle },
          { id: 'settings/password', label: 'Change password', icon: Lock },
        ],
      },
      {
        id: 'settings-workspace',
        label: 'Workspace',
        items: [
          { id: 'settings/roles', label: 'Manage roles', icon: ShieldCheck },
          { id: 'settings/invite', label: 'Invite members', icon: UserPlus },
        ],
      },
    ],
  },
}

const transitionStyle = {
  transitionDuration: '500ms',
  transitionTimingFunction: 'cubic-bezier(0.25, 1.1, 0.4, 1)',
}

function buttonBase(isActive: boolean): string {
  return [
    'flex h-10 w-10 items-center justify-center rounded-lg text-neutral-400',
    'transition-colors duration-300',
    isActive ? 'bg-[#1f1f1f] text-neutral-50' : 'hover:bg-[#1a1a1a] hover:text-neutral-200',
  ].join(' ')
}

function detailButtonClass(isActive: boolean): string {
  return [
    'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
    'transition-colors duration-300',
    isActive ? 'bg-[#1f1f1f] text-neutral-50' : 'text-neutral-300 hover:bg-[#1a1a1a]',
  ].join(' ')
}

function SidebarIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={18} strokeWidth={2} />
}

export function PromoosaSidebar({
  role,
  activeSection,
  onSectionChange,
  isDetailCollapsed,
  activeItemId,
  onItemSelect,
}: PromoosaSidebarProps) {
  const permissionCtx = (() => {
    try {
      return usePermissions()
    } catch {
      return null
    }
  })()

  const canAccessSection = (section: SectionKey): boolean => {
    if (permissionCtx) {
      // Use permission context if available
      const isDisabled = permissionCtx.disabledModules.includes(section)
      const hasPermission = permissionCtx.permissions?.[section as keyof typeof permissionCtx.permissions]?.view ?? false
      return !isDisabled && hasPermission
    }
    // Fall back to role-based access
    return ROLE_SECTION_ACCESS[role][section]
  }

  const firstVisible = useMemo(() => {
    const allowed = ICON_RAIL_ORDER.find((section) => canAccessSection(section))
    return allowed ?? 'dashboard'
  }, [role, permissionCtx?.permissions, permissionCtx?.disabledModules])

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedItemId, setSelectedItemId] = useState<string>(activeItemId ?? '')
  const normalizedActiveSection = (activeSection in SECTION_CONFIG ? activeSection : firstVisible) as SectionKey
  const sectionForRender = canAccessSection(normalizedActiveSection) ? normalizedActiveSection : firstVisible

  const visibleRailSections = ICON_RAIL_ORDER.filter((section) => canAccessSection(section))
  const canOpenSettings = canAccessSection('settings')
  const currentSection = SECTION_CONFIG[sectionForRender]

  const onSelectSection = (section: SectionKey) => {
    onSectionChange(section)
  }

  const onToggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  useEffect(() => {
    if (activeItemId !== undefined) {
      setSelectedItemId(activeItemId)
    }
  }, [activeItemId])

  return (
    <aside className="flex h-full shrink-0 text-[#fafafa]">
      <div className="flex h-full flex-row overflow-hidden bg-[#000000]">
        <div className="flex h-full w-16 shrink-0 flex-col items-center bg-[#000000] py-4">
          <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto px-2">
            {visibleRailSections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => onSelectSection(section)}
                className={buttonBase(sectionForRender === section)}
                aria-label={SECTION_CONFIG[section].title}
              >
                <SidebarIcon icon={SECTION_CONFIG[section].icon} />
              </button>
            ))}
          </div>

          <div className="mt-auto flex flex-col items-center gap-2 px-2 pt-3">
            {canOpenSettings && (
              <button
                type="button"
                onClick={() => onSelectSection('settings')}
                className={buttonBase(sectionForRender === 'settings')}
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
            )}

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
              <span className="text-xs font-semibold text-white">AS</span>
            </div>
          </div>
        </div>

        <div
          className="flex h-full flex-col overflow-hidden bg-[#000000]"
          style={{
            ...transitionStyle,
            width: isDetailCollapsed ? '0px' : '280px',
            opacity: isDetailCollapsed ? 0 : 1,
            borderRight: '0px solid transparent',
            pointerEvents: isDetailCollapsed ? 'none' : 'auto',
          }}
          data-has-expanded-items={expandedItems.size > 0 ? 'true' : 'false'}
        >
          <div className="flex-1 overflow-y-auto p-4">
            {currentSection.groups.map((group) => (
              <div key={group.id} className="mb-4">
                <p className="mb-2 px-2 text-[12px] font-normal uppercase tracking-[0.08em] text-[#525252]">{group.label}</p>
                <div className="space-y-1">
                  {group.items
                    .filter((item) => !(sectionForRender === 'team' && item.id === 'team/add' && role !== 'admin'))
                    .filter((item) => !(sectionForRender === 'settings' && role !== 'admin' && item.id !== 'settings/password'))
                    .map((item) => {
                    const isItemSelected = selectedItemId === item.id
                    const hasSubItems = Boolean(item.subItems?.length)
                    const itemExpanded = expandedItems.has(item.id)
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={detailButtonClass(isItemSelected)}
                        onClick={() => {
                          setSelectedItemId(item.id)
                          onItemSelect?.(item.id, sectionForRender)
                          if (hasSubItems) onToggleExpand(item.id)
                        }}
                      >
                        <Icon size={16} className="shrink-0 text-neutral-400 group-hover:text-neutral-200" />
                        <span className="truncate text-[14px] font-normal">{item.label}</span>
                        {hasSubItems && (
                          <ChevronDown
                            size={14}
                            className="ml-auto text-neutral-500"
                            style={{
                              ...transitionStyle,
                              transform: itemExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default PromoosaSidebar