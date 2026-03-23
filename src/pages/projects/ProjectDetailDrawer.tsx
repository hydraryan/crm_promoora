import { useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { priorityColors, PROJECT_STATUSES, statusMeta, type Project, type ProjectStatus, type Task } from '@/utils/projectConstants'

interface ActivityItem {
  _id: string
  actor: { name: string; initials: string }
  type: string
  description: string
  createdAt: string
}

interface ProjectDetailDrawerProps {
  projectId: string | null
  onClose: () => void
  onUpdated: () => void
}

export default function ProjectDetailDrawer({ projectId, onClose, onUpdated }: ProjectDetailDrawerProps) {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as { role?: string }
    } catch {
      return {}
    }
  }, [])

  const role = storedUser.role ?? 'viewer'

  const [project, setProject] = useState<Project | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const isOpen = Boolean(projectId)

  useEffect(() => {
    if (!isOpen || !projectId) return

    setLoading(true)
    Promise.all([
      apiFetch<{ project: Project }>(`/projects/${projectId}`),
      apiFetch<{ activities: ActivityItem[] }>(`/projects/${projectId}/activity`).catch(() => ({ activities: [] })),
    ])
      .then(([projectRes, activityRes]) => {
        setProject(projectRes.project)
        setActivities(activityRes.activities)
      })
      .finally(() => setLoading(false))
  }, [isOpen, projectId])

  if (!isOpen || !projectId) return null

  async function updateStatus(newStatus: ProjectStatus) {
    if (!project || !(role === 'admin' || role === 'tech_intern')) return

    const res = await apiFetch<{ project: Project }>(`/projects/${project._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    })
    setProject(res.project)
    onUpdated()
  }

  async function updateProgress(value: number) {
    if (!project || !(role === 'admin' || role === 'tech_intern')) return

    const res = await apiFetch<{ project: Project }>(`/projects/${project._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ progress: value }),
    })
    setProject(res.project)
    onUpdated()
  }

  async function toggleTask(taskId: string, isDone: boolean) {
    if (!project) return

    const res = await apiFetch<{ project: Project }>(`/projects/${project._id}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDone }),
    })
    setProject(res.project)
    onUpdated()
  }

  async function addTask() {
    if (!project || !newTaskTitle.trim()) return

    const res = await apiFetch<{ project: Project }>(`/projects/${project._id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: newTaskTitle.trim() }),
    })
    setProject(res.project)
    setNewTaskTitle('')
    onUpdated()
  }

  async function deleteTask(task: Task) {
    if (!project || role !== 'admin') return

    const res = await apiFetch<{ project: Project }>(`/projects/${project._id}/tasks/${task._id}`, {
      method: 'DELETE',
    })
    setProject(res.project)
    onUpdated()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-full w-130 flex-col border-l border-[#1f1f1f] bg-[#111111]">
        {loading || !project ? (
          <div className="space-y-4 px-6 py-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#1a1a1a]" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span style={{ color: statusMeta[project.status].color }}>{statusMeta[project.status].icon}</span>
                <h2 className="truncate text-[15px] font-semibold text-[#fafafa]">{project.title}</h2>
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: priorityColors[project.priority], backgroundColor: `${priorityColors[project.priority]}15` }}
                >
                  {project.priority}
                </span>
              </div>
              <button
                onClick={onClose}
                className="ml-3 flex size-7 shrink-0 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="border-b border-[#1f1f1f] px-6 py-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Progress</p>
                <span className="font-['Geist_Mono'] text-[12px] text-[#71717a]">{project.progress}%</span>
              </div>
              <div className="mb-3 h-1 rounded-full bg-[#1a1a1a]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${project.progress}%`, backgroundColor: project.progress === 100 ? '#22c55e' : '#6366f1' }}
                />
              </div>

              {(role === 'admin' || role === 'tech_intern') && (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={project.progress}
                  onChange={(e) => updateProgress(Number(e.target.value))}
                  className="w-full accent-[#6366f1]"
                />
              )}
            </div>

            {(role === 'admin' || role === 'tech_intern') && (
              <div className="flex flex-wrap items-center gap-2 border-b border-[#1f1f1f] px-6 py-3">
                <p className="mr-1 text-[11px] text-[#3f3f46]">Status:</p>
                {PROJECT_STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(status)}
                    className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors duration-150 ${
                      project.status === status
                        ? 'bg-[#1a1a1a] text-[#a1a1aa]'
                        : 'text-[#3f3f46] hover:bg-[#1a1a1a] hover:text-[#52525b]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-b border-[#1f1f1f] px-6 py-4">
              {[
                { label: 'Client', value: project.client.businessName },
                { label: 'Type', value: project.serviceType },
                {
                  label: 'Start',
                  value: project.startDate
                    ? new Date(project.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '-',
                },
                {
                  label: 'Due',
                  value: project.dueDate
                    ? new Date(project.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '-',
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]">{label}</p>
                  <p className="text-[13px] text-[#a1a1aa]">{value}</p>
                </div>
              ))}

              <div className="col-span-2">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]">Assigned to</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {project.assignedTo.map((member) => (
                    <div key={member._id} className="flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-2 py-1">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2a2a2a]">
                        <span className="text-[8px] text-[#71717a]">{member.initials}</span>
                      </div>
                      <p className="text-[11px] text-[#71717a]">{member.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-b border-[#1f1f1f] px-6 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
                  Tasks
                  <span className="ml-2 font-['Geist_Mono'] text-[#52525b]">
                    {project.tasks?.filter((task) => task.isDone).length ?? 0}/{project.tasks?.length ?? 0}
                  </span>
                </p>
              </div>

              <div className="space-y-px">
                {project.tasks?.map((task) => (
                  <div key={task._id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#1a1a1a]">
                    <button
                      onClick={() => toggleTask(task._id, !task.isDone)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
                        task.isDone ? 'border-[#22c55e]/40 bg-[#22c55e]/20' : 'border-[#2a2a2a] hover:border-[#3f3f46]'
                      }`}
                    >
                      {task.isDone && <Check size={10} className="text-[#22c55e]" />}
                    </button>

                    <p className={`flex-1 text-[12px] transition-colors duration-150 ${task.isDone ? 'text-[#3f3f46] line-through' : 'text-[#a1a1aa]'}`}>
                      {task.title}
                    </p>

                    {task.assignedTo && (
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                        <span className="text-[8px] text-[#52525b]">{task.assignedTo.initials}</span>
                      </div>
                    )}

                    {task.dueDate && (
                      <p className="shrink-0 font-['Geist_Mono'] text-[10px] text-[#3f3f46]">
                        {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    )}

                    {role === 'admin' && (
                      <button onClick={() => deleteTask(task)} className="text-[11px] text-[#52525b] hover:text-[#ef4444]">
                        remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {(role === 'admin' || role === 'tech_intern') && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    placeholder="Add a task..."
                    className="flex-1 rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
                  />
                  <button
                    onClick={addTask}
                    disabled={!newTaskTitle.trim()}
                    className="rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] text-[#6366f1] transition-colors duration-150 hover:bg-[#222222] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Activity</p>
              <div className="space-y-px">
                {activities.map((activity) => (
                  <div key={activity._id} className="flex items-start gap-3 px-2 py-2">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                      <span className="text-[9px] text-[#71717a]">{activity.actor.initials}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-relaxed text-[#71717a]">{activity.description}</p>
                    </div>
                    <p className="shrink-0 font-['Geist_Mono'] text-[10px] text-[#3f3f46]">{formatRelativeTime(activity.createdAt)}</p>
                  </div>
                ))}
                {activities.length === 0 && <p className="text-[12px] text-[#52525b]">No activity yet</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
