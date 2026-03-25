export const ROLES = ['admin', 'bd_intern', 'tech_intern', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  bd_intern: 'BD Intern',
  tech_intern: 'Tech Intern',
  viewer: 'Viewer',
}

export const roleColors: Record<Role, string> = {
  admin: '#6366f1',
  bd_intern: '#f59e0b',
  tech_intern: '#22c55e',
  viewer: '#52525b',
}

export interface TeamMember {
  _id: string
  name: string
  email: string
  phone: string
  role: Role
  initials: string
  status: 'active' | 'inactive'
  joinedAt: string
  createdBy: string
  invitePending?: boolean
  createdAt: string
}

export interface UserSession {
  _id: string
  userId: string
  loginAt: string
  logoutAt?: string
  ipAddress?: string
  userAgent?: string
}

export interface DailyAttendance {
  date: string
  dayOfWeek: number
  isWorkingDay: boolean
  sessions: UserSession[]
  firstLogin?: string
  lastLogout?: string
  totalMinutes: number
  loginMinutes: number
  activeMinutes: number
  productivityRatio: number
  status: 'present' | 'absent' | 'optional' | 'active'
}

export interface MonthlyAttendanceSummary {
  month: string
  presentDays: number
  absentDays: number
  optionalDays: number
  totalWorkingDays: number
  attendancePercent: number
  avgHoursPerDay: number
  avgActiveHoursPerDay: number
  loginMinutes: number
  activeMinutes: number
  productivityRatio: number
  days: DailyAttendance[]
}

export interface MemberWorkload {
  member: Pick<TeamMember, '_id' | 'name' | 'initials' | 'role' | 'status'>
  leadsAssigned: number
  followupsPending: number
  projectsAssigned: number
  proposalsSent: number
}

export function canViewFullProfile(viewerRole: Role, viewerUserId: string, targetUserId: string): boolean {
  if (viewerRole === 'admin') return true
  if (viewerUserId === targetUserId) return true
  return false
}

export function canViewAttendance(viewerRole: Role, viewerUserId: string, targetUserId: string): boolean {
  return canViewFullProfile(viewerRole, viewerUserId, targetUserId)
}
