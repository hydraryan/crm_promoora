import { Building2, UserCircle } from 'lucide-react'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { channelMeta, outcomeMeta, OUTCOMES, type CommEntry, type Outcome } from '@/utils/commConstants'

interface CommEntryRowProps {
  entry: CommEntry
  showActor?: boolean
  onOutcomeChange?: (outcome: Outcome) => void
}

export function CommEntryRow({ entry, showActor = true, onOutcomeChange }: CommEntryRowProps) {
  const ch = channelMeta[entry.channel]
  const ChannelIcon = ch.icon

  return (
    <div className="group flex items-start gap-4 rounded-xl px-3 py-3 hover:bg-[#1a1a1a]">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${ch.color}15` }}>
        <span style={{ color: ch.color }}>
          <ChannelIcon size={13} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-relaxed text-[#a1a1aa]">{entry.description}</p>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[#3f3f46]">{entry.target.targetType === 'lead' ? <UserCircle size={11} /> : <Building2 size={11} />}</span>
            <p className="text-[11px] text-[#52525b]">{entry.target.name}</p>
          </div>

          {showActor && (
            <>
              <span className="text-[#2a2a2a]">.</span>
              <div className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1a1a1a]">
                  <span className="text-[8px] text-[#71717a]">{entry.actor.initials}</span>
                </div>
                <p className="text-[11px] text-[#52525b]">{entry.actor.name}</p>
              </div>
            </>
          )}

          {(entry.type === 'lead_stage_changed' || entry.type === 'stage_changed') && entry.meta?.fromStage && (
            <>
              <span className="text-[#2a2a2a]">.</span>
              <p className="text-[11px] text-[#3f3f46]">
                {entry.meta.fromStage}
                <span className="mx-1 text-[#2a2a2a]">-&gt;</span>
                {entry.meta.toStage}
              </p>
            </>
          )}

          {entry.meta?.proposalNumber && (
            <>
              <span className="text-[#2a2a2a]">.</span>
              <p className="font-['Geist_Mono'] text-[11px] text-[#3f3f46]">{entry.meta.proposalNumber}</p>
            </>
          )}

          {entry.meta?.invoiceNumber && (
            <>
              <span className="text-[#2a2a2a]">.</span>
              <p className="font-['Geist_Mono'] text-[11px] text-[#3f3f46]">{entry.meta.invoiceNumber}</p>
            </>
          )}
        </div>

        {entry.type === 'followup_done' && (
          <div className="mt-2 flex items-center gap-1.5">
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                onClick={() => onOutcomeChange?.(outcome)}
                disabled={!onOutcomeChange}
                className={`rounded-md px-2 py-0.5 text-[10px] transition-colors duration-150 ${
                  entry.outcome === outcome
                    ? 'font-medium'
                    : 'text-[#3f3f46] hover:text-[#52525b] disabled:hover:text-[#3f3f46]'
                }`}
                style={
                  entry.outcome === outcome
                    ? {
                        color: outcomeMeta[outcome].color,
                        backgroundColor: `${outcomeMeta[outcome].color}15`,
                      }
                    : undefined
                }
              >
                {outcomeMeta[outcome].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-0.5 shrink-0 text-right">
        <p className="font-['Geist_Mono'] text-[11px] text-[#3f3f46]">{formatRelativeTime(entry.createdAt)}</p>
        <p className="mt-0.5 font-['Geist_Mono'] text-[10px] text-[#2a2a2a]">
          {new Date(entry.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
