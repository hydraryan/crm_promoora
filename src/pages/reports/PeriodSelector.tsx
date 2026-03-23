export type Period = 'month' | '30d' | '60d' | '90d' | '6m' | 'custom'

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period, from: string, to: string) => void
  customFrom?: string
  customTo?: string
  onCustomChange?: (from: string, to: string) => void
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30d' },
  { key: '60d', label: 'Last 60d' },
  { key: '90d', label: 'Last 90d' },
  { key: '6m', label: 'Last 6 months' },
  { key: 'custom', label: 'Custom' },
]

export function periodToDates(period: Period, customFrom?: string, customTo?: string) {
  const today = new Date()
  const to = today.toISOString().split('T')[0]

  if (period === 'custom') return { from: customFrom ?? to, to: customTo ?? to }

  const from = new Date(today)
  if (period === 'month') {
    from.setDate(1)
  } else if (period === '30d') {
    from.setDate(today.getDate() - 30)
  } else if (period === '60d') {
    from.setDate(today.getDate() - 60)
  } else if (period === '90d') {
    from.setDate(today.getDate() - 90)
  } else if (period === '6m') {
    from.setMonth(today.getMonth() - 6)
  }

  return { from: from.toISOString().split('T')[0], to }
}

export function PeriodSelector({ value, onChange, customFrom, customTo, onCustomChange }: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1">
        {PERIODS.map((period) => (
          <button
            key={period.key}
            onClick={() => {
              const dates = periodToDates(period.key, customFrom, customTo)
              onChange(period.key, dates.from, dates.to)
            }}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] transition-colors ${
              value === period.key ? 'bg-[#1a1a1a] text-[#fafafa]' : 'text-[#52525b] hover:text-[#a1a1aa]'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom ?? ''}
            onChange={(event) => onCustomChange?.(event.target.value, customTo ?? '')}
            className="rounded-lg bg-[#111111] px-2.5 py-1.5 text-[11px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          />
          <input
            type="date"
            value={customTo ?? ''}
            onChange={(event) => onCustomChange?.(customFrom ?? '', event.target.value)}
            className="rounded-lg bg-[#111111] px-2.5 py-1.5 text-[11px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>
      )}
    </div>
  )
}
