import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiFetch } from '@/utils/apiFetch'
import { exportCSV } from '@/utils/exportCSV'
import { axisTick, tooltipStyle } from '@/utils/reportConstants'
import { periodToDates, type Period } from '@/pages/reports/PeriodSelector'
import { ReportShell } from '@/pages/reports/ReportShell'
import type { Role } from '@/utils/teamConstants'

interface FollowupCompletionData {
  summary: {
    totalScheduled: number
    totalCompleted: number
    totalOverdue: number
    completionRate: number
  }
  byMember: Array<{
    _id: string
    name: string
    initials: string
    scheduled: number
    completed: number
    overdue: number
    completionRate: number
  }>
  byType: Array<{
    type: 'Phone call' | 'WhatsApp' | 'Walk-in'
    scheduled: number
    completed: number
    completionRate: number
  }>
  weeklyTrend: Array<{
    week: string
    completed: number
    overdue: number
  }>
}

const TYPE_COLORS: Record<'Phone call' | 'WhatsApp' | 'Walk-in', string> = {
  'Phone call': '#6366f1',
  WhatsApp: '#22c55e',
  'Walk-in': '#f59e0b',
}

export default function FollowupCompletion({ role }: { role: Role }) {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FollowupCompletionData | null>(null)

  const { from, to } = useMemo(() => periodToDates(period, customFrom, customTo), [period, customFrom, customTo])

  useEffect(() => {
    if (role !== 'admin') return
    let active = true
    setLoading(true)

    apiFetch<FollowupCompletionData>(`/reports/followup-completion?from=${from}&to=${to}`)
      .then((response) => {
        if (active) setData(response)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [role, from, to])

  if (role !== 'admin') {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0a] px-8 py-7">
        <p className="text-sm text-[#52525b]">Reports are available to admins only.</p>
      </div>
    )
  }

  const safeData: FollowupCompletionData =
    data ??
    ({
      summary: { totalScheduled: 0, totalCompleted: 0, totalOverdue: 0, completionRate: 0 },
      byMember: [],
      byType: [],
      weeklyTrend: [],
    } as FollowupCompletionData)

  function handleExportCSV() {
    exportCSV(
      'followup-completion',
      ['Name', 'Scheduled', 'Completed', 'Overdue', 'Completion Rate'],
      safeData.byMember.map((member) => [member.name, member.scheduled, member.completed, member.overdue, `${member.completionRate.toFixed(1)}%`]),
    )
  }

  return (
    <ReportShell
      title="Follow-up completion"
      subtitle="Completion trends by week, channel, and team member"
      period={period}
      onPeriodChange={(nextPeriod, nextFrom, nextTo) => {
        setPeriod(nextPeriod)
        if (nextPeriod === 'custom') {
          setCustomFrom(nextFrom)
          setCustomTo(nextTo)
        }
      }}
      customFrom={customFrom}
      customTo={customTo}
      onCustomChange={(nextFrom, nextTo) => {
        setCustomFrom(nextFrom)
        setCustomTo(nextTo)
      }}
      onExportCSV={handleExportCSV}
      loading={loading}
    >
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Scheduled', value: safeData.summary.totalScheduled, color: '#a1a1aa' },
          { label: 'Completed', value: safeData.summary.totalCompleted, color: '#22c55e' },
          { label: 'Overdue', value: safeData.summary.totalOverdue, color: '#ef4444' },
          { label: 'Completion rate', value: `${safeData.summary.completionRate.toFixed(1)}%`, color: '#6366f1' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card rounded-2xl bg-[#111111] p-5">
            <p className="stat-label mb-3 text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">{stat.label}</p>
            <p className="font-['Geist_Mono'] text-[28px] font-medium" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl bg-[#111111] p-5">
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">Weekly follow-up activity</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={safeData.weeklyTrend} barCategoryGap="40%">
            <CartesianGrid vertical={false} stroke="#1f1f1f" />
            <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#52525b' }} />
            <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
            <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" opacity={0.6} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 rounded-2xl bg-[#111111] p-5">
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">By channel</p>
        <div className="space-y-5">
          {safeData.byType.map((type) => (
            <div key={type.type}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[12px] text-[#71717a]">{type.type}</p>
                <p className="font-['Geist_Mono'] text-[11px] text-[#52525b]">
                  {type.completed}/{type.scheduled} - {type.completionRate.toFixed(1)}%
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(type.completionRate, 100)}%`, backgroundColor: TYPE_COLORS[type.type] }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-[#111111] p-5">
        <p className="mb-4 text-[13px] font-medium text-[#a1a1aa]">By team member</p>
        <div className="mb-1 grid grid-cols-[1fr_100px_110px_100px_130px] gap-4 px-3 py-2">
          {['Member', 'Scheduled', 'Completed', 'Overdue', 'Rate'].map((header) => (
            <p key={header} className="text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]">
              {header}
            </p>
          ))}
        </div>

        {[...safeData.byMember]
          .sort((a, b) => b.completionRate - a.completionRate)
          .map((member) => (
            <div key={member._id} className="grid grid-cols-[1fr_100px_110px_100px_130px] items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
                  <span className="text-[8px] text-[#71717a]">{member.initials}</span>
                </div>
                <p className="text-[13px] text-[#a1a1aa]">{member.name}</p>
              </div>
              <p className="font-['Geist_Mono'] text-[12px] text-[#71717a]">{member.scheduled}</p>
              <p className="font-['Geist_Mono'] text-[12px] text-[#22c55e]">{member.completed}</p>
              <p className="font-['Geist_Mono'] text-[12px]" style={{ color: member.overdue > 3 ? '#ef4444' : '#71717a' }}>
                {member.overdue}
              </p>
              <div className="flex items-center gap-2">
                <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(member.completionRate, 100)}%`,
                      backgroundColor: member.completionRate >= 80 ? '#22c55e' : member.completionRate >= 60 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <p className="w-12 text-right font-['Geist_Mono'] text-[11px] text-[#52525b]">{member.completionRate.toFixed(1)}%</p>
              </div>
            </div>
          ))}
      </div>
    </ReportShell>
  )
}
