import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

interface LeadRow {
  _id: string
  businessName: string
  ownerName: string
  assignedTo: { name: string; initials: string }
  lastActivityAt: string
  createdAt: string
}

interface StageSummary {
  name: string
  count: number
  leads: LeadRow[]
}

interface PipelineSummaryData {
  totalLeads: number
  stages: StageSummary[]
  wonThisMonth: number
  lostThisMonth: number
}

export default function PipelineSummary() {
  const [data, setData] = useState<PipelineSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['Cold']))

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await apiFetch<PipelineSummaryData>('/leads/pipeline-summary')
      setData(result)
    } catch {
      setError('Pipeline endpoint not available yet. Expected: GET /api/leads/pipeline-summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const toggleStage = (stageName: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageName)) next.delete(stageName)
      else next.add(stageName)
      return next
    })
  }

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
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => void fetchData()} className="text-[#6366f1] text-sm hover:text-[#818cf8]" type="button">
              Try again
            </button>
            {error.toLowerCase().includes('session expired') && (
              <button
                onClick={() => {
                  localStorage.removeItem('crm_access_token')
                  localStorage.removeItem('crm_refresh_token')
                  localStorage.removeItem('crm_user')
                  sessionStorage.removeItem('crm_portal_secure_session')
                  window.location.reload()
                }}
                className="text-sm text-[#ef4444] hover:text-[#f87171]"
                type="button"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    )

  if (!data) return null

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7 space-y-6">
      <div className="bg-[#111111] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-[#a1a1aa]">Pipeline summary</p>
          <p className="text-[12px] font-['Geist_Mono'] text-[#52525b]">{data.totalLeads}</p>
        </div>

        <div className="space-y-1">
          {data.stages.map((stage) => (
            <div key={stage.name}>
              <button
                type="button"
                onClick={() => toggleStage(stage.name)}
                className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-[#1a1a1a] cursor-pointer"
              >
                <p className="flex-1 text-left text-[13px] font-medium text-[#a1a1aa]">{stage.name}</p>
                <span className="text-[12px] font-['Geist_Mono'] text-[#52525b]">{stage.count}</span>
                <div className="w-30 h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6366f1] rounded-full"
                    style={{
                      width: `${data.totalLeads > 0 ? (stage.count / data.totalLeads) * 100 : 0}%`,
                      opacity: 0.3 + (data.totalLeads > 0 ? (stage.count / data.totalLeads) * 0.7 : 0),
                    }}
                  />
                </div>
                <ChevronDown
                  size={12}
                  className={`text-[#3f3f46] transition-transform duration-200 ${expandedStages.has(stage.name) ? 'rotate-180' : ''}`}
                />
              </button>

              {expandedStages.has(stage.name) && (
                <div className="ml-3 space-y-px border-l border-[#1f1f1f] pl-4 mb-2">
                  {stage.leads.map((lead) => (
                    <div
                      key={lead._id}
                      className="flex items-center gap-4 px-3 py-2 rounded-xl hover:bg-[#1a1a1a] group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[#a1a1aa] group-hover:text-[#fafafa] truncate">{lead.businessName}</p>
                        <p className="text-[11px] text-[#52525b]">{lead.ownerName}</p>
                      </div>
                      <p className="text-[11px] text-[#52525b] shrink-0">{lead.assignedTo.name}</p>
                      <p className="text-[11px] text-[#3f3f46] font-['Geist_Mono'] shrink-0">
                        {formatRelativeTime(lead.lastActivityAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="flex items-center gap-6 text-[12px] text-[#52525b]">
          <p>
            Won this month:{' '}
            <span className="font-['Geist_Mono'] text-[#22c55e]">{data.wonThisMonth}</span>
          </p>
          <p>
            Lost this month:{' '}
            <span className="font-['Geist_Mono'] text-[#ef4444]">{data.lostThisMonth}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
