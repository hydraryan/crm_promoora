import { useMemo, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import type { Proposal } from '@/utils/proposalConstants'

interface AcceptProposalModalProps {
  isOpen: boolean
  proposal: Proposal | null
  onClose: () => void
  onSuccess: () => void
}

function mapServiceToProjectType(key: string): 'Website build' | 'Automation tools' | 'UI/UX design' {
  if (key === 'uiux_design') return 'UI/UX design'
  if (key === 'website_build') return 'Website build'
  return 'Automation tools'
}

export default function AcceptProposalModal({ isOpen, proposal, onClose, onSuccess }: AcceptProposalModalProps) {
  const [step, setStep] = useState(1)
  const [convertLead, setConvertLead] = useState(true)
  const [createProject, setCreateProject] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as { _id?: string }
    } catch {
      return {}
    }
  }, [])

  if (!isOpen || !proposal) return null
  const activeProposal = proposal

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await apiFetch(`/proposals/${activeProposal._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Accepted', acceptedAt: new Date().toISOString() }),
      })

      let resolvedClientId = activeProposal.client?._id

      if (convertLead && activeProposal.targetType === 'lead' && activeProposal.lead) {
        const created = await apiFetch<{ client: { _id: string } }>('/clients', {
          method: 'POST',
          body: JSON.stringify({
            businessName: activeProposal.lead.businessName,
            ownerName: activeProposal.lead.ownerName,
            phone: activeProposal.lead.phone,
            email: activeProposal.lead.email,
            businessType: 'Shop & retail',
            status: 'Onboarding',
            assignedTo: user._id,
            notes: 'Converted from accepted proposal',
          }),
        }).catch(() => null)

        resolvedClientId = created?.client?._id ?? resolvedClientId
      }

      if (createProject && resolvedClientId) {
        const firstService = activeProposal.serviceBlocks[0]
        await apiFetch('/projects', {
          method: 'POST',
          body: JSON.stringify({
            title: `${activeProposal.title} Implementation`,
            description: `Created from accepted proposal ${activeProposal.proposalNumber}`,
            clientId: resolvedClientId,
            serviceType: mapServiceToProjectType(firstService?.serviceKey ?? ''),
            assignedTo: [user._id ?? activeProposal.createdBy._id],
            priority: 'medium',
            notes: activeProposal.notes,
          }),
        }).catch(() => null)
      }

      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[#1f1f1f] bg-[#111111]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">Accept proposal</h2>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a]">
            <X size={15} />
          </button>
        </div>

        {step === 1 && proposal.targetType === 'lead' && (
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3 rounded-xl border border-[#22c55e]/15 bg-[#22c55e]/8 p-4">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#22c55e]" />
              <div>
                <p className="text-[13px] font-medium text-[#fafafa]">Proposal accepted</p>
                <p className="text-[12px] text-[#a1a1aa]">You can now convert this lead to a client and start delivery.</p>
              </div>
            </div>

            <p className="text-[13px] text-[#a1a1aa]">Would you like to convert this lead to a client?</p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setConvertLead(true)}
                className={`flex-1 rounded-xl py-2 text-[13px] transition-colors ${convertLead ? 'bg-[#6366f1] text-white' : 'bg-[#1a1a1a] text-[#71717a]'}`}
              >
                Yes, convert
              </button>
              <button
                onClick={() => setConvertLead(false)}
                className={`flex-1 rounded-xl py-2 text-[13px] transition-colors ${!convertLead ? 'bg-[#6366f1] text-white' : 'bg-[#1a1a1a] text-[#71717a]'}`}
              >
                Skip for now
              </button>
            </div>

            <button onClick={() => setStep(2)} className="w-full rounded-xl bg-[#6366f1] py-2 text-[13px] font-medium text-white hover:bg-[#4f46e5]">
              Continue
            </button>
          </div>
        )}

        {(step === 2 || proposal.targetType === 'client') && (
          <div className="space-y-4 p-6">
            <p className="text-[13px] text-[#a1a1aa]">Would you like to create a project for this engagement?</p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateProject(true)}
                className={`flex-1 rounded-xl py-2 text-[13px] transition-colors ${createProject ? 'bg-[#6366f1] text-white' : 'bg-[#1a1a1a] text-[#71717a]'}`}
              >
                Yes, create project
              </button>
              <button
                onClick={() => setCreateProject(false)}
                className={`flex-1 rounded-xl py-2 text-[13px] transition-colors ${!createProject ? 'bg-[#6366f1] text-white' : 'bg-[#1a1a1a] text-[#71717a]'}`}
              >
                Skip project
              </button>
            </div>

            {createProject && (
              <div className="space-y-1 rounded-xl bg-[#1a1a1a] p-4 text-[12px] text-[#a1a1aa]">
                <p className="font-medium text-[#fafafa]">Project summary</p>
                <p>Title: {proposal.title} Implementation</p>
                <p>Service blocks: {proposal.serviceBlocks.length}</p>
                <p>Milestones: {proposal.milestones.length}</p>
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full rounded-xl bg-[#6366f1] py-2 text-[13px] font-medium text-white hover:bg-[#4f46e5] disabled:opacity-60"
            >
              {submitting ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
