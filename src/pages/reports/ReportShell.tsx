import { Download, Printer } from 'lucide-react'
import { PeriodSelector, type Period } from '@/pages/reports/PeriodSelector'
import { ReportPrintFooter, ReportPrintHeader } from '@/pages/reports/ReportPrintComponents'
import '@/pages/reports/reportPrint.css'

interface ReportShellProps {
  title: string
  subtitle: string
  period: Period
  onPeriodChange: (period: Period, from: string, to: string) => void
  customFrom?: string
  customTo?: string
  onCustomChange?: (from: string, to: string) => void
  onExportCSV: () => void
  children: React.ReactNode
  loading?: boolean
}

export function ReportShell({
  title,
  subtitle,
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomChange,
  onExportCSV,
  children,
  loading,
}: ReportShellProps) {
  return (
    <div className="min-h-full bg-[#0a0a0a]">
      <div className="no-print border-b border-[#1f1f1f] px-8 py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Reports</p>
            <h1 className="text-[22px] font-semibold text-[#fafafa]">{title}</h1>
            <p className="mt-1 text-[12px] text-[#52525b]">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#111111] px-3 py-2 text-[12px] text-[#a1a1aa] transition-colors hover:bg-[#1a1a1a]"
            >
              <Download size={13} />
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#111111] px-3 py-2 text-[12px] text-[#a1a1aa] transition-colors hover:bg-[#1a1a1a]"
            >
              <Printer size={13} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="period-selector-row">
          <PeriodSelector
            value={period}
            onChange={onPeriodChange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={onCustomChange}
          />
        </div>
      </div>

      <div className="report-print-header" style={{ display: 'none' }}>
        <ReportPrintHeader title={title} period={period} customFrom={customFrom} customTo={customTo} />
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#111111]" />
            ))}
          </div>
        ) : (
          children
        )}
      </div>

      <div className="report-print-footer" style={{ display: 'none' }}>
        <ReportPrintFooter />
      </div>
    </div>
  )
}
