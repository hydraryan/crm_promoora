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
    <div className={`group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors duration-100 ${fu.isDone ? 'opacity-50 hover:opacity-70' : 'hover:bg-[#1a1a1a]'}`}>
      <button
        onClick={() => onToggleDone(fu._id, !fu.isDone)}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
          fu.isDone ? 'border-[#22c55e]/40 bg-[#22c55e]/20' : 'border-[#2a2a2a] hover:border-[#3f3f46]'
        }`}
      >
        {fu.isDone && <Check size={10} className="text-[#22c55e]" />}
      </button>

      <span style={{ color: followupTypeMeta[fu.type].color }} className="shrink-0">
        {followupTypeMeta[fu.type].icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] ${fu.isDone ? 'text-[#3f3f46] line-through' : 'text-[#a1a1aa] group-hover:text-[#fafafa]'}`}>
          {target?.businessName ?? '-'}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-[11px] text-[#52525b]">{target?.ownerName}</p>
          {contact && (
            <>
              <span className="text-[#2a2a2a]">·</span>
              <p className="max-w-40 truncate text-[11px] text-[#52525b]">{contact}</p>
            </>
          )}
          {fu.targetType === 'lead' && fu.lead?.stage && (
            <>
              <span className="text-[#2a2a2a]">·</span>
              <p className="text-[11px] text-[#3f3f46]">{fu.lead.stage}</p>
            </>
          )}
          {fu.note && (
            <>
              <span className="text-[#2a2a2a]">·</span>
              <p className="max-w-30 truncate text-[11px] text-[#3f3f46]">{fu.note}</p>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
          <span className="text-[9px] text-[#71717a]">{fu.assignedTo.initials}</span>
        </div>
        <p className="hidden text-[11px] text-[#52525b] sm:block">{fu.assignedTo.name}</p>
      </div>

      <button
        onClick={() => onViewProfile(fu)}
        className="shrink-0 rounded-lg bg-[#1a1a1a] px-2.5 py-1 text-[11px] text-[#71717a] transition-colors hover:bg-[#222222] hover:text-[#a1a1aa]"
      >
        View full profile
      </button>

      <div className="shrink-0 text-right">
        <p className="font-['Geist_Mono'] text-[11px]" style={{ color: urgency.color }}>
          {urgency.label}
        </p>
        <p className="font-['Geist_Mono'] text-[10px] text-[#3f3f46]">
          {new Date(fu.dueAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
