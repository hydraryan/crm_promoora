import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, CalendarClock, CheckCircle2, Circle, FileText, PhoneCall, XCircle } from 'lucide-react'

export const PIPELINE_STAGES = [
  'Cold',
  'Contacted',
  'Meeting scheduled',
  'Proposal sent',
  'Negotiation',
  'Won',
  'Lost',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_TO_API_STAGE: Record<PipelineStage, string> = {
  Cold: 'Cold',
  Contacted: 'Contacted',
  'Meeting scheduled': 'Meeting',
  'Proposal sent': 'Proposal sent',
  Negotiation: 'Negotiation',
  Won: 'Won',
  Lost: 'Lost',
}

export const API_STAGE_TO_STAGE: Record<string, PipelineStage> = {
  Cold: 'Cold',
  Contacted: 'Contacted',
  Meeting: 'Meeting scheduled',
  'Proposal sent': 'Proposal sent',
  Negotiation: 'Negotiation',
  Won: 'Won',
  Lost: 'Lost',
}

export const stageIcons: Record<PipelineStage, LucideIcon> = {
  Cold: Circle,
  Contacted: PhoneCall,
  'Meeting scheduled': CalendarClock,
  'Proposal sent': FileText,
  Negotiation: ArrowLeftRight,
  Won: CheckCircle2,
  Lost: XCircle,
}
