import { Building2, Scissors, ShoppingBag, Stethoscope, Utensils } from 'lucide-react'
import type { ReactNode } from 'react'

export const CLIENT_STATUSES = ['Active', 'Onboarding', 'Inactive'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const BUSINESS_TYPES = ['Restaurant', 'Clinic', 'Salon', 'Shop & retail', 'Other'] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export const statusColors: Record<ClientStatus, string> = {
  Active: '#22c55e',
  Onboarding: '#f59e0b',
  Inactive: '#52525b',
}

export function statusDot(status: ClientStatus) {
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusColors[status] }} />
}

export const businessTypeIcons: Record<BusinessType, ReactNode> = {
  Restaurant: <Utensils size={13} />,
  Clinic: <Stethoscope size={13} />,
  Salon: <Scissors size={13} />,
  'Shop & retail': <ShoppingBag size={13} />,
  Other: <Building2 size={13} />,
}

export interface Client {
  _id: string
  businessName: string
  ownerName: string
  phone: string
  email?: string
  businessType: BusinessType
  status: ClientStatus
  assignedTo: {
    _id: string
    name: string
    initials: string
  }
  website?: string
  address?: string
  services: string[]
  onboardingStartedAt?: string
  activeFrom?: string
  contractValue?: number
  notes?: string
  createdAt: string
  convertedFromLead?: string
}
