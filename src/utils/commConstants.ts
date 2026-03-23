import type { LucideIcon } from 'lucide-react'
import { Activity, Building2, List, Mail, MapPin, MessageSquare, Phone, UserCircle } from 'lucide-react'

export const COMM_CHANNELS = ['all', 'whatsapp', 'call', 'walkin', 'email', 'internal'] as const
export type CommChannel = (typeof COMM_CHANNELS)[number]

export const OUTCOMES = ['positive', 'neutral', 'follow-up needed'] as const
export type Outcome = (typeof OUTCOMES)[number]

export interface CommEntry {
  _id: string
  channel: CommChannel
  type: string
  actor: {
    _id: string
    name: string
    initials: string
  }
  target: {
    _id: string
    name: string
    targetType: 'lead' | 'client'
  }
  description: string
  outcome?: Outcome
  meta?: {
    followupType?: string
    fromStage?: string
    toStage?: string
    proposalNumber?: string
    invoiceNumber?: string
  }
  createdAt: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export const channelMeta: Record<CommChannel, { label: string; icon: LucideIcon; color: string }> = {
  all: { label: 'All', icon: List, color: '#a1a1aa' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: '#22c55e' },
  call: { label: 'Calls', icon: Phone, color: '#6366f1' },
  walkin: { label: 'Walk-ins', icon: MapPin, color: '#f59e0b' },
  email: { label: 'Email', icon: Mail, color: '#3b82f6' },
  internal: { label: 'Internal', icon: Activity, color: '#52525b' },
}

export const outcomeMeta: Record<Outcome, { color: string; label: string }> = {
  positive: { color: '#22c55e', label: 'Positive' },
  neutral: { color: '#52525b', label: 'Neutral' },
  'follow-up needed': { color: '#f59e0b', label: 'Follow-up needed' },
}

export function deriveChannel(entry: { type: string; meta?: { followupType?: string }; description?: string }): CommChannel {
  if (entry.type === 'followup_done') {
    const followupType = entry.meta?.followupType ?? entry.description ?? ''
    const normalized = followupType.toLowerCase()

    if (normalized.includes('whatsapp')) return 'whatsapp'
    if (normalized.includes('phone call') || normalized.includes('call')) return 'call'
    if (normalized.includes('walk-in') || normalized.includes('walk in') || normalized.includes('walkin')) return 'walkin'
    return 'call'
  }

  if (entry.type === 'proposal_sent' || entry.type === 'invoice_sent') return 'email'
  if (entry.type === 'lead_stage_changed' || entry.type === 'stage_changed') return 'internal'
  return 'internal'
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const key = keyFn(item)
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    },
    {} as Record<string, T[]>,
  )
}

export const commViewMap: Record<string, { defaultChannel?: CommChannel; groupBy?: 'client' | 'member' | 'date'; titleOverride: string }> = {
  'comm/whatsapp': { defaultChannel: 'whatsapp', titleOverride: 'WhatsApp log' },
  'comm/email': { defaultChannel: 'email', titleOverride: 'Email log' },
  'comm/calls': { defaultChannel: 'call', titleOverride: 'Call log' },
  'comm/by-client': { groupBy: 'client', titleOverride: 'By client' },
  'comm/by-member': { groupBy: 'member', titleOverride: 'By team member' },
  'comm/by-date': { groupBy: 'date', titleOverride: 'By date' },
}

export interface TeamMemberOption {
  _id: string
  name: string
}

export function targetTypeIcon(targetType: 'lead' | 'client'): LucideIcon {
  return targetType === 'lead' ? UserCircle : Building2
}
