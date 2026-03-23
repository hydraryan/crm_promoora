import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiFetch } from '@/utils/apiFetch'
import { exportCSV } from '@/utils/exportCSV'
import { axisTick, CHART_COLORS, formatINR, tooltipStyle } from '@/utils/reportConstants'
import { periodToDates, type Period } from '@/pages/reports/PeriodSelector'
import { ReportShell } from '@/pages/reports/ReportShell'
import type { Role } from '@/utils/teamConstants'

interface RevenueData {
  summary: {
    totalInvoiced: number
    totalCollected: number
    totalOutstanding: number
    totalOverdue: number
    collectionRate: number
  }
  monthlyTrend: Array<{ month: string; invoiced: number; collected: number }>
  topClients: Array<{ clientName: string; totalInvoiced: number; totalPaid: number; invoiceCount: number }>
  invoiceStatusBreakdown: Array<{ status: 'Paid' | 'Unpaid' | 'Overdue'; count: number; amount: number }>
}

const STATUS_COLORS: Record<'Paid' | 'Unpaid' | 'Overdue', string> = {
  Paid: '#22c55e',
  Unpaid: '#f59e0b',
  Overdue: '#ef4444',
}

export default function RevenueSummary({ role }: { role: Role }) {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RevenueData | null>(null)

  const { from, to } = useMemo(() => periodToDates(period, customFrom, customTo), [period, customFrom, customTo])

  useEffect(() => {
    if (role !== 'admin') return
    let active = true
    setLoading(true)

    apiFetch<RevenueData>(`/reports/revenue?from=${from}&to=${to}`)
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

  const safeData: RevenueData =
    data ??
    ({
      summary: { totalInvoiced: 0, totalCollected: 0, totalOutstanding: 0, totalOverdue: 0, collectionRate: 0 },
      monthlyTrend: [],
      topClients: [],
      invoiceStatusBreakdown: [],
    } as RevenueData)

  function handleExportCSV() {
    exportCSV(
      'revenue-summary',
      ['Month', 'Invoiced (INR)', 'Collected (INR)'],
      safeData.monthlyTrend.map((month) => [month.month, month.invoiced, month.collected]),
    )
  }

  return (
    <ReportShell
      title="Revenue summary"
      subtitle="Invoiced, collected and outstanding performance"
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
          { label: 'Total invoiced', value: formatINR(safeData.summary.totalInvoiced), color: '#a1a1aa' },
          { label: 'Collected', value: formatINR(safeData.summary.totalCollected), color: '#22c55e' },
          { label: 'Outstanding', value: formatINR(safeData.summary.totalOutstanding), color: '#f59e0b' },
          { label: 'Collection rate', value: `${safeData.summary.collectionRate.toFixed(1)}%`, color: '#6366f1' },
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
        <p className="mb-5 text-[13px] font-medium text-[#a1a1aa]">Revenue trend</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={safeData.monthlyTrend}>
            <defs>
              <linearGradient id="invoicedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.indigo} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.gridLine} />
            <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(value) => formatINR(Number(value))} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatINR(Number(value ?? 0))]} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#52525b' }} />
            <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke={CHART_COLORS.indigo} strokeWidth={2} fill="url(#invoicedGrad)" />
            <Area type="monotone" dataKey="collected" name="Collected" stroke={CHART_COLORS.green} strokeWidth={2} fill="url(#collectedGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl bg-[#111111] p-5">
          <p className="mb-4 text-[13px] font-medium text-[#a1a1aa]">Invoice status</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={safeData.invoiceStatusBreakdown} dataKey="amount" nameKey="status" innerRadius={44} outerRadius={72}>
                {safeData.invoiceStatusBreakdown.map((item) => (
                  <Cell key={item.status} fill={STATUS_COLORS[item.status]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatINR(Number(value ?? 0))]} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-1">
            {safeData.invoiceStatusBreakdown.map((item) => (
              <div key={item.status} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[item.status] }} />
                  <span className="text-[#71717a]">{item.status}</span>
                </div>
                <span className="font-['Geist_Mono'] text-[#a1a1aa]">{formatINR(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#111111] p-5">
          <p className="mb-4 text-[13px] font-medium text-[#a1a1aa]">Top clients by revenue</p>
          <div className="space-y-px">
            {safeData.topClients.slice(0, 5).map((client, index) => (
              <div key={client.clientName} className="grid grid-cols-[30px_1fr_120px] items-center rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                <p className="font-['Geist_Mono'] text-[12px] text-[#3f3f46]">{index + 1}</p>
                <p className="text-[13px] text-[#a1a1aa]">{client.clientName}</p>
                <p className="text-right font-['Geist_Mono'] text-[12px] text-[#22c55e]">{formatINR(client.totalPaid)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ReportShell>
  )
}
