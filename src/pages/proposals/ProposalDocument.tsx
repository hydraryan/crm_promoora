import type { Proposal } from '@/utils/proposalConstants'

export function ProposalDocument({ proposal }: { proposal: Proposal }) {
  const target = proposal.targetType === 'lead' ? proposal.lead : proposal.client

  return (
    <div className="bg-white text-[#111]" style={{ fontFamily: 'Geist, sans-serif' }}>
      <div className="flex flex-col min-h-95 justify-between bg-[#0a0a0a] px-12 py-12 text-white">
        <div>
          <p className="font-['Geist_Mono'] text-xs uppercase tracking-[0.2em] text-white/70">Promoora</p>
          <h1 className="mt-8 text-4xl font-semibold leading-tight">Proposal</h1>
          <p className="mt-2 text-sm text-white/75">{proposal.title}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="mb-1 text-white/60">Proposal no.</p>
            <p className="font-['Geist_Mono'] text-base">{proposal.proposalNumber}</p>
          </div>
          <div>
            <p className="mb-1 text-white/60">Prepared for</p>
            <p className="text-base">{target?.businessName ?? '—'}</p>
            <p className="text-xs text-white/70">{target?.ownerName ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-10 px-12 py-10">
        <section>
          <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.16em] text-[#52525b]">Overview</h2>
          <p className="text-[14px] leading-relaxed text-[#2a2a2a]">
            Thank you for considering Promoora. This document outlines the proposed scope, delivery plan, and milestones for your engagement.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.16em] text-[#52525b]">Scope of Work</h2>
          <div className="space-y-5">
            {proposal.serviceBlocks.map((block, idx) => (
              <div key={block.id} className="rounded-xl border border-[#e4e4e7] p-4">
                <p className="font-['Geist_Mono'] text-xs text-[#52525b]">Service {idx + 1}</p>
                <h3 className="mt-1 text-[17px] font-semibold">{block.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#3f3f46]">{block.description}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-[#27272a]">
                  {block.deliverables.map((item, i) => (
                    <li key={`${block.id}-${i}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.16em] text-[#52525b]">Timeline</h2>
          <div className="space-y-2">
            {proposal.milestones.map((milestone, idx) => (
              <div key={milestone.id} className="flex items-center gap-4 rounded-lg border border-[#e4e4e7] px-3 py-2">
                <span className="w-6 font-['Geist_Mono'] text-xs text-[#71717a]">{idx + 1}</span>
                <p className="flex-1 text-[13px] text-[#18181b]">{milestone.title}</p>
                <p className="font-['Geist_Mono'] text-xs text-[#52525b]">{milestone.duration}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[#e4e4e7] pt-6 text-[12px] text-[#52525b]">
          <p>Prepared by {proposal.createdBy.name} on {new Date(proposal.createdAt).toLocaleDateString('en-IN')}</p>
          <p className="mt-1">Contact: {target?.ownerName ?? '—'} {target?.phone ? `• ${target.phone}` : ''}</p>
        </section>
      </div>
    </div>
  )
}
