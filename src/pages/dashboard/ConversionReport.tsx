import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/utils/apiFetch'

interface StageBreakdown {
  stage: string
  entered: number
  converted: number
  conversionRate: number
}

interface MonthConversion {
  label: string
  totalLeadsEntered: number
  stageBreakdown: StageBreakdown[]
  overallConversionRate: number
  dealsWon: number
  revenueValue: number | null
}

interface ConversionData {
  period: 'month'
  months: MonthConversion[]
  bestMonth: string
  avgConversionRate: number
}

interface TeamConversionMember {
  name: string
  initials: string
  _id: string
  dealsWon: number
  leadsWorked: number
  conversionRate: number
  avgDaysToClose: number | null
}

interface TeamConversionData {
  members: TeamConversionMember[]
}

export default function ConversionReport() {
  const role = useMemo(() => {
    const raw = localStorage.getItem('crm_user') ?? localStorage.getItem('user')
    const parsed = raw ? (JSON.parse(raw) as { role?: string }) : {}
    return parsed.role ?? 'viewer'
  }, [])

  const [data, setData] = useState<ConversionData | null>(null)
  const [teamData, setTeamData] = useState<TeamConversionData | null>(null)
  const [months, setMonths] = useState(6)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStageBreakdown, setShowStageBreakdown] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const report = await apiFetch<ConversionData>(`/reports/conversion?period=month&months=${months}`)
      setData(report)

      if (role === 'admin') {
        const team = await apiFetch<TeamConversionData>('/reports/conversion/team?period=month')
        setTeamData(team)
      } else {
        setTeamData(null)
      }
    } catch {
      setError('Failed to load conversion report')
    } finally {
      setLoading(false)
    }
  }, [months, role])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (loading)
    return (
      <div className="min-h-full bg-[#0a0a0a] px-8 py-7 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#111111] rounded-2xl h-24 animate-pulse" />
        ))}
      </div>
    )

  if (error)
    return (
      <div className="min-h-full bg-[#0a0a0a] px-8 py-7 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[#52525b] text-sm">{error}</p>
          <button onClick={() => void fetchData()} className="text-[#6366f1] text-sm hover:text-[#818cf8]" type="button">
            Try again
          </button>
        </div>
      </div>
    )

  if (!data) return null

  const latestMonth = data.months[data.months.length - 1]
  const totalDealsWon = data.months.reduce((sum, month) => sum + month.dealsWon, 0)

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#404040] mb-1">Analytics</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">Conversion report</h1>
        </div>

        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="bg-[#111111] border border-[#1f1f1f] text-[#a1a1aa] text-[13px] rounded-xl px-3 py-2 outline-none focus:border-[#6366f1]"
        >
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      <div className="flex items-center gap-8 mb-2 flex-wrap">
        <p className="text-[12px] text-[#52525b]">
          Avg conversion rate: <span className="font-['Geist_Mono'] text-[#a1a1aa]">{data.avgConversionRate.toFixed(1)}%</span>
        </p>
        <p className="text-[12px] text-[#52525b]">
          Best month: <span className="font-['Geist_Mono'] text-[#a1a1aa]">{data.bestMonth}</span>
        </p>
        <p className="text-[12px] text-[#52525b]">
          Total deals won: <span className="font-['Geist_Mono'] text-[#a1a1aa]">{totalDealsWon}</span>
        </p>
      </div>

      <div className="bg-[#111111] rounded-2xl p-5">
        <p className="text-[13px] font-medium text-[#a1a1aa] mb-5">Monthly overview</p>
        <div className="space-y-3">
          {data.months.map((month) => (
            <div key={month.label} className="flex items-center gap-4">
              <p className="text-[12px] text-[#52525b] w-20 shrink-0">{month.label}</p>
              <div className="flex-1 h-0.75 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6366f1] rounded-full transition-all duration-700"
                  style={{ width: `${month.overallConversionRate}%` }}
                />
              </div>
              <p className="text-[12px] font-['Geist_Mono'] text-[#71717a] w-10 text-right shrink-0">
                {month.overallConversionRate.toFixed(1)}%
              </p>
              <p className="text-[11px] font-['Geist_Mono'] text-[#52525b] w-12 text-right shrink-0">{month.dealsWon} won</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-medium text-[#a1a1aa]">Latest month stage breakdown</p>
          <button
            type="button"
            onClick={() => setShowStageBreakdown((prev) => !prev)}
            className="text-[11px] text-[#6366f1] hover:text-[#818cf8]"
          >
            {showStageBreakdown ? 'Hide stage breakdown' : 'Show stage breakdown'}
          </button>
        </div>

        {showStageBreakdown && latestMonth && (
          <div>
            {latestMonth.stageBreakdown.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-4 py-2">
                <p className="text-[11px] text-[#52525b] w-36 shrink-0">{stage.stage} → next</p>
                <div className="flex-1 h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6366f1] rounded-full"
                    style={{
                      width: `${stage.conversionRate}%`,
                      opacity: 0.5 + (stage.conversionRate / 100) * 0.5,
                    }}
                  />
                </div>
                <p className="text-[11px] font-['Geist_Mono'] text-[#52525b] w-10 text-right">{stage.conversionRate}%</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {role === 'admin' && teamData && (
        <div className="bg-[#111111] rounded-2xl p-5">
          <p className="text-[13px] font-medium text-[#a1a1aa] mb-4">Team conversion</p>
          <div className="space-y-px">
            {[...teamData.members]
              .sort((a, b) => b.conversionRate - a.conversionRate)
              .map((member) => (
                <div key={member._id} className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#1a1a1a]">
                  <div className="w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-medium text-[#71717a]">{member.initials}</span>
                  </div>
                  <p className="flex-1 text-[13px] text-[#a1a1aa]">{member.name}</p>
                  <p className="text-[11px] font-['Geist_Mono'] text-[#52525b]">{member.leadsWorked} leads</p>
                  <p className="text-[11px] font-['Geist_Mono'] text-[#52525b]">{member.dealsWon} won</p>
                  <p className="text-[12px] font-['Geist_Mono'] text-[#a1a1aa]">{member.conversionRate.toFixed(1)}%</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
