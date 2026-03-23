import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiFetch } from '@/utils/apiFetch'
import { exportCSV } from '@/utils/exportCSV'
import { axisTick, CHART_COLORS, tooltipStyle } from '@/utils/reportConstants'
import { periodToDates, type Period } from '@/pages/reports/PeriodSelector'
import { ReportShell } from '@/pages/reports/ReportShell'
import type { Role } from '@/utils/teamConstants'

interface BDPerformanceData {
  period: { from: string; to: string }
  members: Array<{
    _id: string
    name: string
    initials: string
    role: string
    leadsContacted: number
    followupsDone: number
    proposalsSent: number
    dealsWon: number
    conversionRate: number
  }>
  totals: {
    leadsContacted: number
    followupsDone: number
    proposalsSent: number
    dealsWon: number
  }
}

export default function BDPerformance({ role }: { role: Role }) {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BDPerformanceData | null>(null)

  const { from, to } = useMemo(() => periodToDates(period, customFrom, customTo), [period, customFrom, customTo])

  useEffect(() => {
    if (role !== 'admin') return
    let active = true
    setLoading(true)

    apiFetch<BDPerformanceData>(`/reports/bd-performance?from=${from}&to=${to}`)
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

  const safeData: BDPerformanceData =
    data ??
    ({
      period: { from, to },
      members: [],
      totals: { leadsContacted: 0, followupsDone: 0, proposalsSent: 0, dealsWon: 0 },
    } as BDPerformanceData)

  function handleExportCSV() {
    exportCSV(
      'bd-performance',
      ['Name', 'Leads Contacted', 'Follow-ups Done', 'Proposals Sent', 'Deals Won', 'Conversion Rate'],
      safeData.members.map((member) => [
        member.name,
        member.leadsContacted,
        member.followupsDone,
        member.proposalsSent,
        member.dealsWon,
        `${member.conversionRate.toFixed(1)}%`,
      ]),
    )
  }

  return (
    <ReportShell
      title="BD performance"
      subtitle="Member-level productivity and conversions"
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
          { label: 'Leads contacted', value: safeData.totals.leadsContacted, color: '#6366f1' },
          { label: 'Follow-ups done', value: safeData.totals.followupsDone, color: '#22c55e' },
          { label: 'Proposals sent', value: safeData.totals.proposalsSent, color: '#f59e0b' },
          { label: 'Deals won', value: safeData.totals.dealsWon, color: '#A855F7' },
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
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">Team comparison</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={safeData.members} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#1f1f1f" />
            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#52525b' }} />
            <Bar dataKey="leadsContacted" name="Leads contacted" fill={CHART_COLORS.indigo} radius={[3, 3, 0, 0]} />
            <Bar dataKey="followupsDone" name="Follow-ups done" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} />
            <Bar dataKey="proposalsSent" name="Proposals sent" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} />
            <Bar dataKey="dealsWon" name="Deals won" fill={CHART_COLORS.purple} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl bg-[#111111] p-5">
        <p className="mb-4 text-[13px] font-medium text-[#a1a1aa]">Leaderboard</p>

        <div className="mb-1 grid grid-cols-[1fr_100px_120px_120px_110px_130px] gap-4 px-3 py-2">
          {['Member', 'Contacted', 'Follow-ups', 'Proposals', 'Deals won', 'Conv. rate'].map((header) => (
            <p key={header} className="text-[10px] font-medium uppercase tracking-widest text-[#3f3f46]">
              {header}
            </p>
          ))}
        </div>

        {[...safeData.members]
          .sort((a, b) => b.dealsWon - a.dealsWon)
          .map((member, index) => (
            <div key={member._id} className="grid grid-cols-[1fr_100px_120px_120px_110px_130px] items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <span className="w-4 font-['Geist_Mono'] text-[11px] text-[#3f3f46]">{index + 1}</span>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
                  <span className="text-[8px] text-[#71717a]">{member.initials}</span>
                </div>
                <p className="text-[13px] text-[#a1a1aa]">{member.name}</p>
              </div>

              <p className="font-['Geist_Mono'] text-[13px] text-[#6366f1]">{member.leadsContacted}</p>
              <p className="font-['Geist_Mono'] text-[13px] text-[#22c55e]">{member.followupsDone}</p>
              <p className="font-['Geist_Mono'] text-[13px] text-[#f59e0b]">{member.proposalsSent}</p>
              <p className="font-['Geist_Mono'] text-[13px] text-[#A855F7]">{member.dealsWon}</p>

              <div className="flex items-center gap-2">
                <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(member.conversionRate, 100)}%`,
                      backgroundColor: member.conversionRate >= 40 ? '#22c55e' : '#f59e0b',
                    }}
                  />
                </div>
                <p className="w-12 text-right font-['Geist_Mono'] text-[11px] text-[#52525b]">{member.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          ))}
      </div>
    </ReportShell>
  )
}
