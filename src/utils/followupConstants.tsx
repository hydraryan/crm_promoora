import { MapPin, MessageSquare, Phone } from 'lucide-react'
import type { ReactNode } from 'react'

export const FOLLOWUP_TYPES = ['Phone call', 'Walk-in', 'WhatsApp'] as const
export type FollowupType = (typeof FOLLOWUP_TYPES)[number]

export const followupTypeMeta: Record<FollowupType, { icon: ReactNode; color: string }> = {
  'Phone call': { icon: <Phone size={13} />, color: '#6366f1' },
  'Walk-in': { icon: <MapPin size={13} />, color: '#f59e0b' },
  WhatsApp: { icon: <MessageSquare size={13} />, color: '#22c55e' },
}

export interface Followup {
  _id: string
  lead?: {
    _id: string
    businessName: string
    ownerName: string
    phone?: string
    email?: string
    stage: string
  }
  client?: {
    _id: string
    businessName: string
    ownerName: string
    phone?: string
    email?: string
  }
  targetType: 'lead' | 'client'
  type: FollowupType
  note?: string
  dueAt: string
  isDone: boolean
  completedAt?: string
  isOverdue: boolean
  assignedTo: {
    _id: string
    name: string
    initials: string
  }
  createdBy: {
    _id: string
    name: string
    initials: string
  }
  createdAt: string
}

export function getUrgencyLabel(dueAt: string, isDone: boolean): { label: string; color: string } {
  if (isDone) return { label: 'Done', color: '#22c55e' }
  const diff = new Date(dueAt).getTime() - Date.now()
  const hours = diff / 3600000
  if (diff < 0) return { label: 'Overdue', color: '#ef4444' }
  if (hours < 2) return { label: 'Due soon', color: '#f59e0b' }
  if (hours < 24) return { label: 'Due today', color: '#f59e0b' }
  const days = Math.ceil(diff / 86400000)
  return { label: `In ${days}d`, color: '#52525b' }
}
