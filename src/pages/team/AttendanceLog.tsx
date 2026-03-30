import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { roleColors, type Role } from '@/utils/teamConstants'

type AttendanceMemberSummary = {
  member: {
    _id: string
    name: string
    initials: string
    role: Role
    status: 'active' | 'inactive'
  }
  summary: {
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
  }
}

interface AttendanceLogProps {
  role: Role
  currentUserId: string
  onOpenMember: (memberId: string) => void
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

export default function AttendanceLog({ role, currentUserId, onOpenMember }: AttendanceLogProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKeyIST(new Date()))
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AttendanceMemberSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [includeInactive, setIncludeInactive] = useState(false)

  useEffect(() => {
    if (role !== 'admin') {
      setLoading(false)
      setError(null)
      return
    }

    let active = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await apiFetch<{ month: string; members: AttendanceMemberSummary[] }>(
          `/team/attendance?month=${selectedMonth}&includeInactive=${includeInactive ? 'true' : 'false'}`,
        )
        if (active) setRows(response.members || [])
      } catch (err) {
        if (active) {
          setRows([])
          setError(err instanceof Error ? err.message : 'Failed to load attendance data')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [role, selectedMonth, refreshNonce, includeInactive])

  function prevMonth() {
    const d = new Date(`${selectedMonth}-01T00:00:00`)
    d.setMonth(d.getMonth() - 1)
    setSelectedMonth(toMonthKeyIST(d))
  }

  function nextMonth() {
    const d = new Date(`${selectedMonth}-01T00:00:00`)
    d.setMonth(d.getMonth() + 1)
    const nextMonth = toMonthKeyIST(d)
    if (nextMonth <= toMonthKeyIST(new Date())) setSelectedMonth(nextMonth)
  }

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#111111]" />
        ))}
      </div>
    )

  if (role !== 'admin') {
    return (
      <div className="min-h-full rounded-2xl bg-[#111111] p-6">
        <p className="text-[13px] text-[#71717a]">Attendance log is available for admins only.</p>
        <button onClick={() => onOpenMember(currentUserId)} className="mt-3 rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#222222]">
          Open my profile
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-full rounded-2xl bg-[#111111] p-6">
        <p className="text-[13px] text-[#f87171]">{error}</p>
        <button
          onClick={() => setRefreshNonce((prev) => prev + 1)}
          className="mt-3 rounded-lg bg-[#1a1a1a] px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#222222]"
        >
          Retry
        </button>
      </div>
    )
  }

  const sortedRows = [...rows].sort((a, b) => b.summary.attendancePercent - a.summary.attendancePercent)

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Team</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">Attendance log</h1>
          <p className="mt-1 text-[11px] text-[#52525b]">Productivity = active website time / login time</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIncludeInactive((prev) => !prev)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] transition-colors ${
              includeInactive ? 'bg-[#1f2937] text-[#a1a1aa]' : 'bg-[#111111] text-[#52525b] hover:text-[#a1a1aa]'
            }`}
          >
            {includeInactive ? 'Showing inactive' : 'Active only'}
          </button>

          <button onClick={prevMonth} className="flex size-7 items-center justify-center rounded-lg text-[#52525b] transition-colors hover:bg-[#111111]">
            <ChevronLeft size={14} />
          </button>
          <p className="w-28 text-center font-['Geist_Mono'] text-[13px] text-[#a1a1aa]">{toMonthLabel(selectedMonth)}</p>
          <button onClick={nextMonth} className="flex size-7 items-center justify-center rounded-lg text-[#52525b] transition-colors hover:bg-[#111111]">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="mb-1 hidden grid-cols-[1fr_80px_90px_90px_130px_130px_120px_130px] gap-4 px-3 py-2 lg:grid">
        {['Member', 'Present', 'Absent', 'Sundays', 'Avg login/day', 'Avg active/day', 'Productivity', 'Attendance'].map((col) => (
          <p key={col} className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
            {col}
          </p>
        ))}
      </div>

      <div className="space-y-px">
        {sortedRows.map(({ member, summary }) => (
          <div key={member._id}>
            <div
              onClick={() => onOpenMember(member._id)}
              className="group hidden cursor-pointer grid-cols-[1fr_80px_90px_90px_130px_130px_120px_130px] gap-4 rounded-xl border-b border-[#1a1a1a] px-3 py-2.5 hover:bg-[#1a1a1a] last:border-b-0 lg:grid"
            >
              <div className="flex items-center gap-3 self-center">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${roleColors[member.role]}20` }}>
                  <span className="text-[10px] font-medium" style={{ color: roleColors[member.role] }}>
                    {member.initials}
                  </span>
                </div>
                <p className="text-[13px] text-[#a1a1aa] transition-colors group-hover:text-[#fafafa]">{member.name}</p>
                {member.status !== 'active' && <span className="rounded-md bg-[#3f3f46]/20 px-1.5 py-0.5 text-[9px] text-[#71717a]">inactive</span>}
              </div>

              <p className="self-center font-['Geist_Mono'] text-[13px] text-[#22c55e]">{summary.presentDays}</p>
              <p className={`self-center font-['Geist_Mono'] text-[13px] ${summary.absentDays > 3 ? 'text-[#ef4444]' : 'text-[#52525b]'}`}>{summary.absentDays}</p>
              <p className="self-center font-['Geist_Mono'] text-[13px] text-[#6366f1]">{summary.optionalDays > 0 ? summary.optionalDays : '—'}</p>
              <p className="self-center font-['Geist_Mono'] text-[13px] text-[#71717a]">{summary.avgHoursPerDay > 0 ? `${summary.avgHoursPerDay.toFixed(1)}h` : '—'}</p>
              <p className="self-center font-['Geist_Mono'] text-[13px] text-[#71717a]">{summary.avgActiveHoursPerDay > 0 ? `${summary.avgActiveHoursPerDay.toFixed(1)}h` : '—'}</p>
              <p className="self-center font-['Geist_Mono'] text-[13px] text-[#a1a1aa]">{Math.round(summary.productivityRatio * 100)}%</p>

              <div className="flex items-center gap-2 self-center">
                <div className="flex-1 overflow-hidden rounded-full bg-[#1a1a1a]" style={{ height: 3 }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${summary.attendancePercent}%`,
                      backgroundColor: summary.attendancePercent >= 80 ? '#22c55e' : summary.attendancePercent >= 60 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <p className="w-8 shrink-0 text-right font-['Geist_Mono'] text-[11px] text-[#71717a]">{Math.round(summary.attendancePercent)}%</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenMember(member._id)}
              className="mb-2 w-full rounded-xl border border-[#1f1f1f] bg-[#111111] p-3 text-left transition-colors hover:bg-[#1a1a1a] lg:hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-[#a1a1aa]">{member.name}</p>
                  <p className="mt-1 text-[11px] text-[#52525b]">
                    {summary.presentDays} present · {summary.absentDays} absent · {Math.round(summary.attendancePercent)}% attendance
                  </p>
                </div>
                <p className="shrink-0 font-['Geist_Mono'] text-[12px] text-[#a1a1aa]">{Math.round(summary.productivityRatio * 100)}%</p>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${summary.attendancePercent}%`,
                      backgroundColor: summary.attendancePercent >= 80 ? '#22c55e' : summary.attendancePercent >= 60 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                {member.status !== 'active' && <span className="text-[10px] text-[#71717a]">inactive</span>}
              </div>
            </button>
          </div>
        ))}
      </div>

      {sortedRows.length === 0 && <p className="py-12 text-center text-sm text-[#3f3f46]">No attendance data found for this month.</p>}
    </div>
  )
}
