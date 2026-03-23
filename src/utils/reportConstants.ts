export const CHART_COLORS = {
  indigo: '#6366f1',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#A855F7',
  muted: '#3f3f46',
  gridLine: '#1f1f1f',
}

export const tooltipStyle = {
  backgroundColor: '#1a1a1a',
  border: '0.5px solid #2a2a2a',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#a1a1aa',
}

export const axisTick = { fill: '#52525b', fontSize: 11, fontFamily: 'var(--font-mono)' }

export function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}
