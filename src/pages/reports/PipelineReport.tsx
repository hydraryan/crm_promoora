import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { exportCSV } from '@/utils/exportCSV'
import { periodToDates, type Period } from '@/pages/reports/PeriodSelector'
import { ReportShell } from '@/pages/reports/ReportShell'
import type { Role } from '@/utils/teamConstants'

interface PipelineData {
  summary: {
    totalActive: number
    totalWon: number
    totalLost: number
    winRate: number
  }
  stageDistribution: Array<{
    stage: string
    count: number
    percent: number
    avgDaysInStage: number
  }>
  velocity: {
    avgTotalDays: number
    fastestClose: number
    slowestClose: number
  }
  stagnant: Array<{
    _id: string
    businessName: string
    stage: string
    daysSinceActivity: number
    assignedTo: { name: string; initials: string }
  }>
}

export default function PipelineReport({ role }: { role: Role }) {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PipelineData | null>(null)

  const { from, to } = useMemo(() => periodToDates(period, customFrom, customTo), [period, customFrom, customTo])

  useEffect(() => {
    if (role !== 'admin') return
    let active = true
    setLoading(true)

    apiFetch<PipelineData>(`/reports/pipeline?from=${from}&to=${to}`)
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

  const safeData: PipelineData =
    data ??
    ({
      summary: { totalActive: 0, totalWon: 0, totalLost: 0, winRate: 0 },
      stageDistribution: [],
      velocity: { avgTotalDays: 0, fastestClose: 0, slowestClose: 0 },
      stagnant: [],
    } as PipelineData)

  function handleExportCSV() {
    exportCSV(
      'pipeline-report',
      ['Stage', 'Count', 'Percent', 'Avg Days in Stage'],
      safeData.stageDistribution.map((stage) => [stage.stage, stage.count, `${stage.percent.toFixed(1)}%`, Math.round(stage.avgDaysInStage)]),
    )
  }

  return (
    <ReportShell
      title="Pipeline report"
      subtitle="Stage distribution, velocity and stagnant lead tracking"
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
          { label: 'Active leads', value: safeData.summary.totalActive, color: '#6366f1' },
          { label: 'Won', value: safeData.summary.totalWon, color: '#22c55e' },
          { label: 'Lost', value: safeData.summary.totalLost, color: '#ef4444' },
          { label: 'Win rate', value: `${safeData.summary.winRate.toFixed(1)}%`, color: '#f59e0b' },
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
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">Current pipeline</p>
        <div className="space-y-4">
          {safeData.stageDistribution.map((stage) => (
            <div key={stage.stage}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[12px] text-[#71717a]">{stage.stage}</p>
                <div className="flex items-center gap-3">
                  <p className="font-['Geist_Mono'] text-[12px] text-[#a1a1aa]">{stage.count}</p>
                  <p className="font-['Geist_Mono'] text-[11px] text-[#52525b]">{Math.round(stage.avgDaysInStage)}d</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
                <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${Math.min(stage.percent, 100)}%`, opacity: Math.max(stage.percent / 100, 0.25) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-[#111111] p-5">
        <p className="mb-4 text-[13px] font-medium text-[#a1a1aa]">Deal velocity</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: 'Avg days to close', value: `${Math.round(safeData.velocity.avgTotalDays)}d`, color: '#6366f1' },
            { label: 'Fastest close', value: `${safeData.velocity.fastestClose}d`, color: '#22c55e' },
            { label: 'Slowest close', value: `${safeData.velocity.slowestClose}d`, color: '#f59e0b' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#1a1a1a] p-4 text-center">
              <p className="font-['Geist_Mono'] text-[24px] font-medium" style={{ color: item.color }}>
                {item.value}
              </p>
              <p className="mt-1 text-[11px] text-[#52525b]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {safeData.stagnant.length > 0 && (
        <div className="rounded-2xl bg-[#111111] p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={13} className="text-[#f59e0b]" />
            <p className="text-[13px] font-medium text-[#a1a1aa]">Stagnant leads</p>
            <p className="ml-1 text-[11px] text-[#52525b]">- no activity in 14+ days</p>
          </div>

          <div className="space-y-px">
            {safeData.stagnant.map((lead) => (
              <div key={lead._id} className="grid grid-cols-[1fr_150px_180px_90px] items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                <p className="text-[13px] text-[#a1a1aa]">{lead.businessName}</p>
                <p className="text-[12px] text-[#71717a]">{lead.stage}</p>
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
                    <span className="text-[8px] text-[#71717a]">{lead.assignedTo.initials}</span>
                  </div>
                  <p className="text-[12px] text-[#71717a]">{lead.assignedTo.name}</p>
                </div>
                <p className="font-['Geist_Mono'] text-[12px] text-[#f59e0b]">{lead.daysSinceActivity}d</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReportShell>
  )
}
