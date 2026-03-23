import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis, BarChart, Bar, Legend } from 'recharts'
import { apiFetch } from '@/utils/apiFetch'
import { exportCSV } from '@/utils/exportCSV'
import { axisTick, CHART_COLORS, tooltipStyle } from '@/utils/reportConstants'
import { periodToDates, type Period } from '@/pages/reports/PeriodSelector'
import { ReportShell } from '@/pages/reports/ReportShell'
import type { Role } from '@/utils/teamConstants'

interface LeadConversionData {
  period: { from: string; to: string }
  summary: {
    totalLeads: number
    totalConverted: number
    conversionRate: number
    avgDaysToConvert: number
  }
  monthlyTrend: Array<{ month: string; added: number; converted: number }>
  stageFunnel: Array<{ stage: string; count: number; dropOffRate: number }>
  sourceBreakdown: Array<{ source: string; count: number; converted: number; conversionRate: number }>
}

const SOURCE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#A855F7', '#ef4444']

export default function LeadConversion({ role }: { role: Role }) {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LeadConversionData | null>(null)

  const { from, to } = useMemo(() => periodToDates(period, customFrom, customTo), [period, customFrom, customTo])

  useEffect(() => {
    if (role !== 'admin') return
    let active = true

    setLoading(true)
    apiFetch<LeadConversionData>(`/reports/lead-conversion?from=${from}&to=${to}`)
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

  const safeData: LeadConversionData =
    data ??
    ({
      period: { from, to },
      summary: { totalLeads: 0, totalConverted: 0, conversionRate: 0, avgDaysToConvert: 0 },
      monthlyTrend: [],
      stageFunnel: [],
      sourceBreakdown: [],
    } as LeadConversionData)

  function handleExportCSV() {
    exportCSV(
      'lead-conversion',
      ['Month', 'Added', 'Converted'],
      safeData.monthlyTrend.map((month) => [month.month, month.added, month.converted]),
    )
  }

  return (
    <ReportShell
      title="Lead conversion"
      subtitle="Lead conversion trend, stage funnel and source performance"
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
          { label: 'Total leads', value: safeData.summary.totalLeads, color: '#a1a1aa' },
          { label: 'Converted', value: safeData.summary.totalConverted, color: '#22c55e' },
          { label: 'Conversion rate', value: `${safeData.summary.conversionRate.toFixed(1)}%`, color: '#6366f1' },
          { label: 'Avg days to close', value: `${Math.round(safeData.summary.avgDaysToConvert)}d`, color: '#f59e0b' },
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
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">Leads added vs converted</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={safeData.monthlyTrend} barCategoryGap="35%">
            <CartesianGrid vertical={false} stroke={CHART_COLORS.gridLine} />
            <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#ffffff08' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#52525b' }} />
            <Bar dataKey="added" name="Added" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} opacity={0.7} />
            <Bar dataKey="converted" name="Converted" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 rounded-2xl bg-[#111111] p-5">
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">Pipeline funnel</p>
        <div className="space-y-3">
          {safeData.stageFunnel.map((stage) => {
            const maxCount = Math.max(...safeData.stageFunnel.map((item) => item.count), 1)
            const widthPct = Math.min((stage.count / maxCount) * 100, 100)
            return (
              <div key={stage.stage} className="flex items-center gap-4">
                <p className="w-32 text-[12px] text-[#71717a]">{stage.stage}</p>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
                  <div className="h-full rounded-full bg-[#6366f1]" style={{ width: `${widthPct}%` }} />
                </div>
                <p className="w-20 text-right font-['Geist_Mono'] text-[12px] text-[#a1a1aa]">{stage.count}</p>
                <p className="w-16 text-right font-['Geist_Mono'] text-[11px] text-[#52525b]">{stage.dropOffRate.toFixed(1)}%</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-[#111111] p-5">
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">Lead sources</p>
        <div className="grid items-center gap-8 md:grid-cols-[220px_1fr]">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={safeData.sourceBreakdown} dataKey="count" nameKey="source" innerRadius={45} outerRadius={72} paddingAngle={2}>
                {safeData.sourceBreakdown.map((entry, i) => (
                  <Cell key={entry.source} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-px">
            {safeData.sourceBreakdown.map((source, i) => (
              <div key={source.source} className="grid grid-cols-[1fr_80px_120px] items-center rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                  <p className="text-[12px] capitalize text-[#a1a1aa]">{source.source.replace('_', ' ')}</p>
                </div>
                <p className="font-['Geist_Mono'] text-[12px] text-[#71717a]">{source.count}</p>
                <p className="font-['Geist_Mono'] text-[12px] text-[#52525b]">{source.conversionRate.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ReportShell>
  )
}
