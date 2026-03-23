import { CheckCircle2, Clock, FileEdit, Send, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export const PROPOSAL_STATUSES = ['Draft', 'Sent', 'Awaiting response', 'Accepted', 'Rejected'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export interface ProposalServiceBlock {
  id: string
  serviceKey: string
  title: string
  description: string
  deliverables: string[]
}

export interface ProposalMilestone {
  id: string
  title: string
  duration: string
  description?: string
}

export interface Proposal {
  _id: string
  proposalNumber: string
  title: string
  status: ProposalStatus
  lead?: {
    _id: string
    businessName: string
    ownerName: string
    phone: string
    email?: string
  }
  client?: {
    _id: string
    businessName: string
    ownerName: string
    phone: string
    email?: string
  }
  targetType: 'lead' | 'client'
  serviceBlocks: ProposalServiceBlock[]
  milestones: ProposalMilestone[]
  notes?: string
  createdBy: {
    _id: string
    name: string
    initials: string
  }
  sentAt?: string
  acceptedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
}

export const statusMeta: Record<ProposalStatus, { color: string; icon: ReactNode }> = {
  Draft: { color: '#52525b', icon: <FileEdit size={13} /> },
  Sent: { color: '#6366f1', icon: <Send size={13} /> },
  'Awaiting response': { color: '#f59e0b', icon: <Clock size={13} /> },
  Accepted: { color: '#22c55e', icon: <CheckCircle2 size={13} /> },
  Rejected: { color: '#ef4444', icon: <XCircle size={13} /> },
}

export interface ServiceBlockTemplate {
  key: string
  title: string
  description: string
  deliverables: string[]
  defaultMilestones: { title: string; duration: string }[]
}

export const SERVICE_BLOCKS: ServiceBlockTemplate[] = [
  {
    key: 'website_build',
    title: 'Website Build',
    description:
      'A fully custom, mobile-first website built to represent your business online - fast, modern, and designed to convert visitors into customers.',
    deliverables: [
      'Custom website design (up to 5 pages)',
      'Mobile-responsive layout',
      'Contact form with WhatsApp integration',
      'Google Maps embed',
      'Basic SEO setup',
      'Hosting & domain guidance',
    ],
    defaultMilestones: [
      { title: 'Discovery & Design', duration: '3-5 days' },
      { title: 'Development', duration: '5-7 days' },
      { title: 'Review & Revisions', duration: '2-3 days' },
      { title: 'Launch', duration: '1 day' },
    ],
  },
  {
    key: 'hrm_tool',
    title: 'HRM Tool',
    description:
      'A lightweight HR management system tailored for your team - attendance tracking, leave management, and payroll summaries, all accessible from any device.',
    deliverables: [
      'Staff attendance tracking (clock-in / clock-out)',
      'Leave request & approval workflow',
      'Monthly attendance summary report',
      'Role-based access (owner, manager, staff)',
      'WhatsApp alerts for approvals',
    ],
    defaultMilestones: [
      { title: 'Requirements & Setup', duration: '2-3 days' },
      { title: 'Development & Testing', duration: '7-10 days' },
      { title: 'Training & Handover', duration: '1-2 days' },
    ],
  },
  {
    key: 'crm_setup',
    title: 'CRM Setup',
    description:
      'A simple customer relationship management system so you never lose track of a lead - manage inquiries, follow-ups, and customer history from one place.',
    deliverables: [
      'Lead capture & tracking pipeline',
      'Follow-up reminders',
      'Customer contact history',
      'WhatsApp message integration',
      'Monthly conversion summary',
    ],
    defaultMilestones: [
      { title: 'Setup & Configuration', duration: '3-5 days' },
      { title: 'Integration & Testing', duration: '3-5 days' },
      { title: 'Onboarding', duration: '1-2 days' },
    ],
  },
  {
    key: 'uiux_design',
    title: 'UI/UX Design',
    description:
      'Professional interface design for your digital product - from initial wireframes to polished, pixel-perfect screens ready for development.',
    deliverables: [
      'User flow mapping',
      'Low-fidelity wireframes',
      'High-fidelity UI screens',
      'Mobile & desktop versions',
      'Figma source files handover',
      '2 rounds of revisions included',
    ],
    defaultMilestones: [
      { title: 'Research & Wireframes', duration: '3-4 days' },
      { title: 'High-Fidelity Design', duration: '5-7 days' },
      { title: 'Revisions & Handover', duration: '2-3 days' },
    ],
  },
  {
    key: 'full_package',
    title: 'Full Digital Package',
    description:
      'Everything your business needs to go fully online - website, automation tools, and a custom CRM, built and delivered as a complete solution.',
    deliverables: [
      'All Website Build deliverables',
      'All HRM Tool deliverables',
      'All CRM Setup deliverables',
      'Unified dashboard for all tools',
      'Priority support for 30 days post-launch',
    ],
    defaultMilestones: [
      { title: 'Discovery & Planning', duration: '3-5 days' },
      { title: 'Design Phase', duration: '5-7 days' },
      { title: 'Development', duration: '14-18 days' },
      { title: 'Testing & QA', duration: '3-5 days' },
      { title: 'Launch & Handover', duration: '1-2 days' },
    ],
  },
]
