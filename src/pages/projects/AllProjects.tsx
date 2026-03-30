import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Plus, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatePanel } from '@/components/ui/state-panel'
import { apiFetch } from '@/utils/apiFetch'
import { usePermissions } from '@/context/PermissionContext'
import {
  priorityColors,
  PROJECT_STATUSES,
  SERVICE_TYPES,
  serviceTypeIcons,
  statusMeta,
  type Project,
  type ProjectStatus,
  type ServiceType,
} from '@/utils/projectConstants'
import NewProjectModal from './NewProjectModal'
import ProjectDetailDrawer from './ProjectDetailDrawer'

interface AllProjectsProps {
  defaultStatus?: ProjectStatus
  defaultServiceType?: ServiceType
  titleOverride?: string
  openNewProjectModal?: boolean
}

export default function AllProjects({ defaultStatus, defaultServiceType, titleOverride, openNewProjectModal }: AllProjectsProps) {
  const { permissions } = usePermissions()
  const canCreateProjects = Boolean(permissions?.projects?.create)
  const canViewTeam = Boolean(permissions?.team?.view)

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatus ?? '')
  const [typeFilter, setTypeFilter] = useState<string>(defaultServiceType ?? '')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [teamMembers, setTeamMembers] = useState<Array<{ _id: string; name: string; initials: string }>>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showNewProjectModal, setShowNewProjectModal] = useState(Boolean(openNewProjectModal))

  const clearSessionAndReload = () => {
    localStorage.removeItem('crm_access_token')
    localStorage.removeItem('crm_refresh_token')
    localStorage.removeItem('crm_user')
    sessionStorage.removeItem('crm_portal_secure_session')
    window.location.reload()
  }

  useEffect(() => {
    setShowNewProjectModal(Boolean(openNewProjectModal))
  }, [openNewProjectModal])

  useEffect(() => {
    setStatusFilter(defaultStatus ?? '')
  }, [defaultStatus])

  useEffect(() => {
    setTypeFilter(defaultServiceType ?? '')
  }, [defaultServiceType])

  const refetch = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectRes, teamRes] = await Promise.all([
        apiFetch<{ projects: Project[]; total: number }>('/projects'),
        canViewTeam
          ? apiFetch<{ members: Array<{ _id: string; name: string; initials?: string }> }>('/team/members').catch(() => ({ members: [] }))
          : Promise.resolve({ members: [] as Array<{ _id: string; name: string; initials?: string }> }),
      ])

      setProjects(projectRes.projects)
      setTeamMembers(
        teamRes.members.map((member) => ({
          _id: member._id,
          name: member.name,
          initials: member.initials ?? member.name.slice(0, 2).toUpperCase(),
        }))
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.toLowerCase()
    return projects.filter((project) => {
      const matchSearch =
        !normalizedSearch ||
        project.title.toLowerCase().includes(normalizedSearch) ||
        project.client.businessName.toLowerCase().includes(normalizedSearch)
      const matchStatus = !statusFilter || project.status === statusFilter
      const matchType = !typeFilter || project.serviceType === typeFilter
      const matchPriority = !priorityFilter || project.priority === priorityFilter
      const matchAssigned = !assignedFilter || project.assignedTo.some((assignee) => assignee._id === assignedFilter)
      return matchSearch && matchStatus && matchType && matchPriority && matchAssigned
    })
  }, [assignedFilter, priorityFilter, projects, search, statusFilter, typeFilter])

  const dueSoonProjects = useMemo(() => {
    const now = Date.now()
    return projects.filter((project) => {
      if (project.status !== 'In progress' || !project.dueDate) return false
      const dueTime = new Date(project.dueDate).getTime()
      return dueTime - now < 3 * 24 * 60 * 60 * 1000 && dueTime > now
    })
  }, [projects])

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-11 w-full" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )

  if (error)
    return (
      <StatePanel
        tone="error"
        title="Unable to load projects"
        message={error}
        actionLabel="Try again"
        onAction={refetch}
        secondaryActionLabel={error.toLowerCase().includes('session expired') ? 'Log out' : undefined}
        onSecondaryAction={error.toLowerCase().includes('session expired') ? clearSessionAndReload : undefined}
      />
    )

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Projects</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            {titleOverride ?? 'All projects'}
            <span className="ml-3 font-['Geist_Mono'] text-[14px] font-normal text-[#52525b]">{filteredProjects.length}</span>
          </h1>
        </div>

        {canCreateProjects && (
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]"
          >
            <Plus size={14} />
            New project
          </button>
        )}
      </div>

      {defaultStatus === 'In progress' && dueSoonProjects.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/8 px-4 py-3">
          <AlertTriangle size={13} className="shrink-0 text-[#f59e0b]" />
          <p className="text-[12px] text-[#a1a1aa]">
            <span className="font-['Geist_Mono'] text-[#f59e0b]">{dueSoonProjects.length}</span>{' '}
            project{dueSoonProjects.length > 1 ? 's' : ''} due within 3 days
          </p>
        </div>
      )}

      {defaultStatus === 'Under review' && (
        <p className="-mt-4 mb-5 text-[12px] text-[#52525b]">Projects awaiting client or internal sign-off before moving to Completed.</p>
      )}

      {defaultStatus === 'Completed' && (
        <div className="mb-6 flex items-center gap-8">
          <div>
            <p className="font-['Geist_Mono'] text-[22px] font-medium text-[#22c55e]">{projects.filter((project) => project.status === 'Completed').length}</p>
            <p className="mt-0.5 text-[11px] text-[#52525b]">total completed</p>
          </div>
          <div className="h-8 w-px bg-[#1f1f1f]" />
          <div>
            <p className="font-['Geist_Mono'] text-[22px] font-medium text-[#fafafa]">
              {
                projects.filter(
                  (project) =>
                    project.status === 'Completed' &&
                    project.completedAt &&
                    new Date(project.completedAt).getMonth() === new Date().getMonth()
                ).length
              }
            </p>
            <p className="mt-0.5 text-[11px] text-[#52525b]">this month</p>
          </div>
        </div>
      )}

      {defaultStatus === 'On hold' && (
        <p className="-mt-4 mb-5 text-[12px] text-[#52525b]">These projects are paused. Update status when work resumes.</p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3f3f46]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project or client..."
            className="w-full rounded-xl bg-[#111111] py-2 pl-8 pr-3 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>

        {!defaultStatus && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        )}

        {!defaultServiceType && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">All types</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {canViewTeam && (
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">All members</option>
            {teamMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {member.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-1 hidden grid-cols-[1fr_180px_150px_130px_120px_90px_32px] gap-4 px-3 py-2 lg:grid">
        {['Project', 'Client', 'Type', 'Status', 'Progress', 'Due', ''].map((col) => (
          <p key={col} className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
            {col}
          </p>
        ))}
      </div>

      {filteredProjects.map((project) => (
        <div key={project._id}>
          <div
            onClick={() => setSelectedProjectId(project._id)}
            className="group hidden cursor-pointer grid-cols-[1fr_180px_150px_130px_120px_90px_32px] gap-4 rounded-xl border-b border-[#1a1a1a] px-3 py-2.5 hover:bg-[#1a1a1a] last:border-b-0 lg:grid"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColors[project.priority] }} />
              <div className="min-w-0">
                <p className="truncate text-[13px] text-[#a1a1aa] transition-colors duration-100 group-hover:text-[#fafafa]">{project.title}</p>
              </div>
            </div>

            <p className="self-center truncate text-[12px] text-[#71717a]">{project.client.businessName}</p>

            <div className="self-center flex items-center gap-1.5">
              <span className="text-[#71717a]">{serviceTypeIcons[project.serviceType]}</span>
              <span className="text-[12px] text-[#71717a]">{project.serviceType}</span>
            </div>

            <div className="self-center flex items-center gap-1.5">
              <span style={{ color: statusMeta[project.status].color }}>{statusMeta[project.status].icon}</span>
              <span className="text-[12px] text-[#a1a1aa]">{project.status}</span>
            </div>

            <div className="self-center flex items-center gap-2">
              <div className="h-0.75 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${project.progress}%`, backgroundColor: project.progress === 100 ? '#22c55e' : '#6366f1' }}
                />
              </div>
              <span className="w-7 shrink-0 text-right font-['Geist_Mono'] text-[11px] text-[#71717a]">{project.progress}%</span>
            </div>

            <p
              className={`self-center font-['Geist_Mono'] text-[11px] ${
                project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'Completed' ? 'text-[#ef4444]' : 'text-[#71717a]'
              }`}
            >
              {project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
            </p>

            <ChevronRight size={13} className="self-center text-[#52525b] transition-colors duration-100 group-hover:text-[#a1a1aa]" />
          </div>

          <button
            type="button"
            onClick={() => setSelectedProjectId(project._id)}
            className="mb-2 w-full rounded-xl border border-[#1f1f1f] bg-[#111111] p-4 text-left transition-colors hover:bg-[#1a1a1a] lg:hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[#fafafa]">{project.title}</p>
                <p className="mt-1 truncate text-[12px] text-[#a1a1aa]">{project.client.businessName}</p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-[#71717a]" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <p className="text-[#52525b]">Type</p>
                <p className="mt-0.5 truncate text-[#a1a1aa]">{project.serviceType}</p>
              </div>
              <div>
                <p className="text-[#52525b]">Status</p>
                <p className="mt-0.5 truncate text-[#a1a1aa]">{project.status}</p>
              </div>
              <div>
                <p className="text-[#52525b]">Progress</p>
                <p className="mt-0.5 font-['Geist_Mono'] text-[#71717a]">{project.progress}%</p>
              </div>
              <div>
                <p className="text-[#52525b]">Due</p>
                <p className="mt-0.5 font-['Geist_Mono'] text-[#71717a]">
                  {project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                </p>
              </div>
            </div>
          </button>
        </div>
      ))}

      {filteredProjects.length === 0 && !loading && (
        <div className="py-16 text-center">
          <p className="text-sm text-[#3f3f46]">No projects match your filters</p>
        </div>
      )}

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreated={() => {
          refetch()
          setShowNewProjectModal(false)
        }}
      />

      <ProjectDetailDrawer
        projectId={selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
        onUpdated={() => {
          refetch()
        }}
      />
    </div>
  )
}
