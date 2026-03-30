import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import {
  canViewAttendance,
  canViewFullProfile,
  roleColors,
  roleLabels,
  type MonthlyAttendanceSummary,
  type Role,
  type TeamMember,
} from '@/utils/teamConstants'

type ActivityItem = {
  _id: string
  type: string
  description: string
  targetName: string
  createdAt: string
}

type Stats = {
  leadsAssigned: number
  followupsPending: number
  projectsAssigned: number
  proposalsSent: number
}

interface MemberProfileProps {
  role: Role
  currentUserId: string
  memberId: string
  onBack: () => void
}

function toMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function toMonthKeyIST(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

export default function MemberProfile({ role, currentUserId, memberId, onBack }: MemberProfileProps) {
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<TeamMember | null>(null)
  const [stats, setStats] = useState<Stats>({ leadsAssigned: 0, followupsPending: 0, projectsAssigned: 0, proposalsSent: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [attendance, setAttendance] = useState<MonthlyAttendanceSummary | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKeyIST(new Date()))
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)

  const canView = canViewFullProfile(role, currentUserId, memberId)
  const canViewMonthAttendance = canViewAttendance(role, currentUserId, memberId)

  async function loadBase() {
    setLoading(true)
    setError(null)
    try {
      const [memberRes, statsRes, activityRes] = await Promise.all([
        apiFetch<{ member: TeamMember }>(`/team/members/${memberId}`),
        apiFetch<Stats>(`/team/members/${memberId}/stats`),
        apiFetch<{ activities: ActivityItem[] }>(`/team/members/${memberId}/activity?limit=10`),
      ])
      setMember(memberRes.member)
      setStats(statsRes)
      setActivities(activityRes.activities || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load member profile')
    } finally {
      setLoading(false)
    }
  }

  async function loadAttendance() {
    if (!canViewMonthAttendance) {
      setAttendance(null)
      setAttendanceError(null)
      return
    }

    setAttendanceError(null)
    try {
      const data = await apiFetch<{ attendance: MonthlyAttendanceSummary }>(`/team/members/${memberId}/attendance?month=${selectedMonth}`)
      setAttendance(data.attendance)
    } catch (err) {
      setAttendance(null)
      setAttendanceError(err instanceof Error ? err.message : 'Failed to load attendance')
    }
  }

  useEffect(() => {
    if (!canView) return
    loadBase()
  }, [memberId, canView])

  useEffect(() => {
    if (!canViewMonthAttendance) return
    loadAttendance()
  }, [selectedMonth, memberId, canViewMonthAttendance])

  async function updateMemberStatus(next: 'active' | 'inactive') {
    if (!member) return

    setUpdatingStatus(true)
    try {
      const endpoint = next === 'active' ? 'reactivate' : 'deactivate'
      const response = await apiFetch<{ member: TeamMember }>(`/team/members/${member._id}/${endpoint}`, { method: 'PATCH' })
      setMember(response.member)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const summaryStats = useMemo(
    () => [
      { label: 'Leads assigned', value: stats.leadsAssigned, color: '#6366f1' },
      { label: 'Follow-ups pending', value: stats.followupsPending, color: '#f59e0b' },
      { label: 'Projects assigned', value: stats.projectsAssigned, color: '#22c55e' },
      { label: 'Proposals sent', value: stats.proposalsSent, color: '#a1a1aa' },
    ],
    [stats],
  )

  function prevMonth() {
    const d = new Date(`${selectedMonth}-01T00:00:00`)
    d.setMonth(d.getMonth() - 1)
    setSelectedMonth(toMonthKeyIST(d))
  }

  function nextMonth() {
    const d = new Date(`${selectedMonth}-01T00:00:00`)
    d.setMonth(d.getMonth() + 1)
    const nextMonth = toMonthKeyIST(d)
    if (nextMonth <= toMonthKeyIST(new Date())) {
      setSelectedMonth(nextMonth)
    }
  }

  if (!canView) {
    return (
      <div className="min-h-full rounded-2xl bg-[#111111] p-6">
        <p className="text-[13px] text-[#71717a]">You can only view your own profile.</p>
        <button onClick={onBack} className="mt-3 rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#222222]">
          Back to team
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-full rounded-2xl bg-[#111111] p-6">
        <p className="text-[13px] text-[#f87171]">{error}</p>
        <button onClick={onBack} className="mt-3 rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#222222]">
          Back to team
        </button>
      </div>
    )
  }

  if (loading || !member) {
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#111111]" />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-[#1f1f1f] px-8 py-4">
        {role === 'admin' ? (
          <button onClick={onBack} className="flex items-center gap-2 text-[#52525b] transition-colors hover:text-[#a1a1aa]">
            <ArrowLeft size={15} />
            <span className="text-[13px]">Team</span>
          </button>
        ) : (
          <div />
        )}

        {role === 'admin' && member._id !== currentUserId && (
          <div className="flex items-center gap-2">
            {member.status === 'active' ? (
              <button
                onClick={() => updateMemberStatus('inactive')}
                disabled={updatingStatus}
                className="rounded-lg bg-[#ef4444]/10 px-3 py-1.5 text-[12px] text-[#ef4444] transition-colors hover:bg-[#ef4444]/15 disabled:opacity-60"
              >
                Deactivate member
              </button>
            ) : (
              <button
                onClick={() => updateMemberStatus('active')}
                disabled={updatingStatus}
                className="rounded-lg bg-[#22c55e]/10 px-3 py-1.5 text-[12px] text-[#22c55e] transition-colors hover:bg-[#22c55e]/15 disabled:opacity-60"
              >
                Reactivate member
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start gap-6 border-b border-[#1f1f1f] px-8 py-8">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${roleColors[member.role]}20` }}>
          <span className="text-[22px] font-semibold" style={{ color: roleColors[member.role] }}>
            {member.initials}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-semibold text-[#fafafa]">{member.name}</h1>
            <span className="rounded-lg px-2.5 py-1 text-[11px] font-medium" style={{ color: roleColors[member.role], backgroundColor: `${roleColors[member.role]}15` }}>
              {roleLabels[member.role]}
            </span>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] ${member.status === 'active' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#3f3f46]/20 text-[#71717a]'}`}>
              {member.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            {member.invitePending && <span className="rounded-lg bg-[#f59e0b]/10 px-2.5 py-1 text-[11px] text-[#f59e0b]">Invite pending</span>}
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <p className="text-[13px] text-[#52525b]">{member.email}</p>
            <p className="text-[13px] text-[#52525b]">{member.phone}</p>
            <p className="text-[12px] text-[#3f3f46]">Joined {new Date(member.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 border-b border-[#1f1f1f] px-8 py-6">
        {summaryStats.map((stat, idx) => (
          <div key={stat.label} className="flex items-center gap-8">
            {idx > 0 && <div className="h-10 w-px shrink-0 bg-[#1f1f1f]" />}
            <div>
              <p className="font-['Geist_Mono'] text-[24px] font-medium" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="mt-0.5 text-[11px] text-[#52525b]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 px-8 py-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Attendance</p>
              <p className="mt-1 text-[11px] text-[#52525b]">Productivity = active website time / login time</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="flex size-6 items-center justify-center rounded-md text-[#52525b] transition-colors hover:bg-[#1a1a1a]">
                <ChevronLeft size={13} />
              </button>
              <p className="w-24 text-center font-['Geist_Mono'] text-[13px] text-[#a1a1aa]">{toMonthLabel(selectedMonth)}</p>
              <button onClick={nextMonth} className="flex size-6 items-center justify-center rounded-md text-[#52525b] transition-colors hover:bg-[#1a1a1a]">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {!attendance ? (
            <div className="rounded-2xl bg-[#111111] p-6 text-center text-[13px] text-[#52525b]">
              {attendanceError ?? 'Attendance is only available for this member profile.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-[#111111] p-5 sm:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: 'Present', value: attendance.presentDays, color: '#22c55e' },
                  { label: 'Absent', value: attendance.absentDays, color: '#ef4444' },
                  { label: 'Sundays', value: attendance.optionalDays, color: '#6366f1' },
                  { label: 'Avg hrs', value: `${attendance.avgHoursPerDay.toFixed(1)}h`, color: '#a1a1aa' },
                  { label: 'Avg active', value: `${attendance.avgActiveHoursPerDay.toFixed(1)}h`, color: '#22c55e' },
                  { label: 'Productivity', value: `${Math.round(attendance.productivityRatio * 100)}%`, color: '#f59e0b' },
                ].map((summary) => (
                  <div key={summary.label} className="text-center">
                    <p className="font-['Geist_Mono'] text-[20px] font-medium" style={{ color: summary.color }}>
                      {summary.value}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#3f3f46]">{summary.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1a1a1a] sm:h-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${attendance.attendancePercent}%`,
                      backgroundColor: attendance.attendancePercent >= 80 ? '#22c55e' : attendance.attendancePercent >= 60 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <p className="w-10 text-right font-['Geist_Mono'] text-[12px] text-[#71717a]">{Math.round(attendance.attendancePercent)}%</p>
              </div>

              <div className="overflow-hidden rounded-2xl bg-[#111111]">
                <div className="hidden grid-cols-[80px_1fr_90px_90px_110px_110px_90px] gap-3 border-b border-[#1a1a1a] px-4 py-2.5 lg:grid">
                  {['Date', 'Day', 'First login', 'Last logout', 'Login hrs', 'Active hrs', 'Prod'].map((header) => (
                    <p key={header} className="text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]">
                      {header}
                    </p>
                  ))}
                </div>

                {attendance.days
                  .filter((d) => d.isWorkingDay || d.status === 'present' || d.status === 'optional' || d.status === 'active')
                  .map((day) => (
                    <div key={day.date}>
                      <div
                        className={`hidden grid-cols-[80px_1fr_90px_90px_110px_110px_90px] gap-3 border-b border-[#1a1a1a] px-4 py-2.5 last:border-b-0 lg:grid ${day.status === 'absent' ? 'opacity-40' : ''}`}
                      >
                        <p className="font-['Geist_Mono'] text-[12px] text-[#52525b]">{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        <p className="text-[12px] text-[#52525b]">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.dayOfWeek]}
                          {!day.isWorkingDay && <span className="ml-1.5 text-[10px] text-[#6366f1]">optional</span>}
                        </p>
                        <p className="font-['Geist_Mono'] text-[12px] text-[#71717a]">
                          {day.firstLogin ? new Date(day.firstLogin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                        <p className="font-['Geist_Mono'] text-[12px] text-[#71717a]">
                          {day.status === 'active' ? (
                            <span className="text-[#22c55e]">Active</span>
                          ) : day.lastLogout ? (
                            new Date(day.lastLogout).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          ) : (
                            '—'
                          )}
                        </p>
                        <p className={`font-['Geist_Mono'] text-[12px] ${day.loginMinutes > 0 ? 'text-[#a1a1aa]' : 'text-[#3f3f46]'}`}>
                          {day.loginMinutes > 0 ? `${Math.floor(day.loginMinutes / 60)}h ${day.loginMinutes % 60}m` : '—'}
                        </p>
                        <p className={`font-['Geist_Mono'] text-[12px] ${day.activeMinutes > 0 ? 'text-[#22c55e]' : 'text-[#3f3f46]'}`}>
                          {day.activeMinutes > 0 ? `${Math.floor(day.activeMinutes / 60)}h ${day.activeMinutes % 60}m` : '—'}
                        </p>
                        <p className="font-['Geist_Mono'] text-[12px] text-[#71717a]">{day.loginMinutes > 0 ? `${Math.round(day.productivityRatio * 100)}%` : '—'}</p>
                      </div>

                      <div className={`border-b border-[#1a1a1a] px-4 py-3 last:border-b-0 lg:hidden ${day.status === 'absent' ? 'opacity-40' : ''}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-['Geist_Mono'] text-[12px] text-[#a1a1aa]">{new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                          <p className="text-[11px] text-[#71717a]">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.dayOfWeek]}
                            {!day.isWorkingDay && <span className="ml-1.5 text-[#6366f1]">optional</span>}
                          </p>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <p className="text-[#52525b]">First: <span className="font-['Geist_Mono'] text-[#71717a]">{day.firstLogin ? new Date(day.firstLogin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></p>
                          <p className="text-[#52525b]">Last: <span className="font-['Geist_Mono'] text-[#71717a]">{day.status === 'active' ? 'Active' : day.lastLogout ? new Date(day.lastLogout).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></p>
                          <p className="text-[#52525b]">Login: <span className="font-['Geist_Mono'] text-[#a1a1aa]">{day.loginMinutes > 0 ? `${Math.floor(day.loginMinutes / 60)}h ${day.loginMinutes % 60}m` : '—'}</span></p>
                          <p className="text-[#52525b]">Active: <span className="font-['Geist_Mono'] text-[#22c55e]">{day.activeMinutes > 0 ? `${Math.floor(day.activeMinutes / 60)}h ${day.activeMinutes % 60}m` : '—'}</span></p>
                        </div>

                        <p className="mt-2 text-[11px] text-[#52525b]">Productivity: <span className="font-['Geist_Mono'] text-[#a1a1aa]">{day.loginMinutes > 0 ? `${Math.round(day.productivityRatio * 100)}%` : '—'}</span></p>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-[#111111] p-5">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Recent activity</p>
          <div className="space-y-px">
            {activities.map((activity) => (
              <div key={activity._id} className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-[#1a1a1a]">
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                  <span className="text-[8px] font-medium text-[#71717a]">{member.initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-[#a1a1aa]">{activity.description}</p>
                  <p className="mt-1 text-[11px] text-[#52525b]">
                    {activity.targetName} • {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {activities.length === 0 && <p className="px-2 py-4 text-center text-sm text-[#3f3f46]">No recent activity</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
