import { Button } from '@/components/ui/button'

type StatePanelProps = {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  tone?: 'neutral' | 'error'
}

export function StatePanel({
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tone = 'neutral',
}: StatePanelProps) {
  const titleColor = tone === 'error' ? 'text-[#ef4444]' : 'text-[#a1a1aa]'

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-[#111111] p-6 text-center">
        <p className={`text-sm font-medium ${titleColor}`}>{title}</p>
        <p className="mt-2 text-sm text-[#71717a]">{message}</p>

        {(actionLabel || secondaryActionLabel) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {actionLabel && onAction && (
              <Button type="button" size="sm" onClick={onAction} className="bg-[#6366f1] text-white hover:bg-[#4f46e5]">
                {actionLabel}
              </Button>
            )}
            {secondaryActionLabel && onSecondaryAction && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onSecondaryAction}
                className="border-[#27272a] bg-transparent text-[#ef4444] hover:bg-[#1a1a1a] hover:text-[#f87171]"
              >
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
