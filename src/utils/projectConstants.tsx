import { CheckCircle2, Cpu, Eye, Globe, Loader2, Palette, PauseCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export const PROJECT_STATUSES = ['In progress', 'Under review', 'Completed', 'On hold'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const SERVICE_TYPES = ['Website build', 'Automation tools', 'UI/UX design'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export interface Task {
  _id: string
  title: string
  isDone: boolean
  assignedTo?: { _id: string; name: string; initials: string }
  dueDate?: string
  createdAt: string
}

export interface Project {
  _id: string
  title: string
  description?: string
  client: {
    _id: string
    businessName: string
    ownerName: string
  }
  serviceType: ServiceType
  status: ProjectStatus
  assignedTo: {
    _id: string
    name: string
    initials: string
  }[]
  startDate?: string
  dueDate?: string
  completedAt?: string
  priority: 'low' | 'medium' | 'high'
  progress: number
  tasks?: Task[]
  notes?: string
  createdAt: string
  createdBy: {
    _id: string
    name: string
    initials: string
  }
}

export const statusMeta: Record<ProjectStatus, { color: string; icon: ReactNode }> = {
  'In progress': { color: '#6366f1', icon: <Loader2 size={13} className="animate-spin" /> },
  'Under review': { color: '#f59e0b', icon: <Eye size={13} /> },
  Completed: { color: '#22c55e', icon: <CheckCircle2 size={13} /> },
  'On hold': { color: '#52525b', icon: <PauseCircle size={13} /> },
}

export const serviceTypeIcons: Record<ServiceType, ReactNode> = {
  'Website build': <Globe size={13} />,
  'Automation tools': <Cpu size={13} />,
  'UI/UX design': <Palette size={13} />,
}

export const priorityColors: Record<Project['priority'], string> = {
  low: '#52525b',
  medium: '#f59e0b',
  high: '#ef4444',
}

export function statusDot(status: ProjectStatus) {
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusMeta[status].color }} />
}
