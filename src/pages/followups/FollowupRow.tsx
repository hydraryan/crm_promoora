import { Check } from 'lucide-react'
import { followupTypeMeta, getUrgencyLabel, type Followup } from '@/utils/followupConstants'

interface FollowupRowProps {
  fu: Followup
  onToggleDone: (id: string, isDone: boolean) => void
  onViewProfile: (followup: Followup) => void
}

export function FollowupRow({ fu, onToggleDone, onViewProfile }: FollowupRowProps) {
  const urgency = getUrgencyLabel(fu.dueAt, fu.isDone)
  const target = fu.targetType === 'lead' ? fu.lead : fu.client
  const contact = target?.phone ?? target?.email ?? null

  return (
    <div
      className={`group rounded-xl border border-[#1f1f1f] px-3 py-3 transition-colors duration-100 ${
        fu.isDone ? 'opacity-55 hover:opacity-70' : 'hover:bg-[#1a1a1a]'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggleDone(fu._id, !fu.isDone)}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
            fu.isDone ? 'border-[#22c55e]/40 bg-[#22c55e]/20' : 'border-[#2a2a2a] hover:border-[#3f3f46]'
          }`}
        >
          {fu.isDone && <Check size={10} className="text-[#22c55e]" />}
        </button>

        <span style={{ color: followupTypeMeta[fu.type].color }} className="mt-0.5 shrink-0">
          {followupTypeMeta[fu.type].icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`truncate text-[13px] ${fu.isDone ? 'text-[#52525b] line-through' : 'text-[#a1a1aa] group-hover:text-[#fafafa]'}`}>
              {target?.businessName ?? '-'}
            </p>

            <div className="shrink-0 text-right">
              <p className="font-['Geist_Mono'] text-[11px]" style={{ color: urgency.color }}>
                {urgency.label}
              </p>
              <p className="font-['Geist_Mono'] text-[10px] text-[#71717a]">
                {new Date(fu.dueAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[11px] text-[#71717a]">{target?.ownerName}</p>
            {contact && <p className="max-w-40 truncate text-[11px] text-[#71717a]">{contact}</p>}
            {fu.targetType === 'lead' && fu.lead?.stage && <p className="text-[11px] text-[#71717a]">{fu.lead.stage}</p>}
            {fu.note && <p className="max-w-48 truncate text-[11px] text-[#52525b]">{fu.note}</p>}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
            <span className="text-[9px] text-[#a1a1aa]">{fu.assignedTo.initials}</span>
          </div>
          <p className="text-[11px] text-[#71717a]">{fu.assignedTo.name}</p>
        </div>

        <button
          onClick={() => onViewProfile(fu)}
          className="shrink-0 rounded-lg bg-[#1a1a1a] px-2.5 py-1 text-[11px] text-[#a1a1aa] transition-colors hover:bg-[#222222] hover:text-[#fafafa]"
        >
          View full profile
        </button>
      </div>
    </div>
  )
}
