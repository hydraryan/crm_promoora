import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Eye, Plus, Send, Trash2, X } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import {
  statusMeta,
  type Proposal,
  type ProposalMilestone,
  type ProposalServiceBlock,
  type ProposalStatus,
  type ServiceBlockTemplate,
} from '@/utils/proposalConstants'
import ServiceBlockPicker from './ServiceBlockPicker'

interface TargetItem {
  _id: string
  businessName: string
  ownerName: string
}

interface ProposalBuilderProps {
  proposal?: Proposal | null
  onBack: () => void
  onSaved: (proposal: Proposal) => void
  onPreview: (proposal: Proposal) => void
}

interface ProposalForm {
  title: string
  status: ProposalStatus
  targetType: 'lead' | 'client'
  leadId: string
  clientId: string
  serviceBlocks: ProposalServiceBlock[]
  milestones: ProposalMilestone[]
  notes: string
}

const emptyForm: ProposalForm = {
  title: '',
  status: 'Draft',
  targetType: 'lead',
  leadId: '',
  clientId: '',
  serviceBlocks: [],
  milestones: [],
  notes: '',
}

export default function ProposalBuilder({ proposal, onBack, onSaved, onPreview }: ProposalBuilderProps) {
  const [form, setForm] = useState<ProposalForm>(emptyForm)
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leads, setLeads] = useState<TargetItem[]>([])
  const [clients, setClients] = useState<TargetItem[]>([])

  const isEdit = Boolean(proposal?._id)

  useEffect(() => {
    Promise.all([
      apiFetch<{ leads: TargetItem[] }>('/leads').catch(() => ({ leads: [] })),
      apiFetch<{ clients: TargetItem[] }>('/clients').catch(() => ({ clients: [] })),
    ]).then(([leadRes, clientRes]) => {
      setLeads(leadRes.leads)
      setClients(clientRes.clients)
    })
  }, [])

  useEffect(() => {
    if (!proposal) {
      setForm(emptyForm)
      return
    }

    setForm({
      title: proposal.title,
      status: proposal.status,
      targetType: proposal.targetType,
      leadId: proposal.lead?._id ?? '',
      clientId: proposal.client?._id ?? '',
      serviceBlocks: proposal.serviceBlocks,
      milestones: proposal.milestones,
      notes: proposal.notes ?? '',
    })
  }, [proposal])

  const selectedTargetLabel = useMemo(() => {
    if (form.targetType === 'lead') {
      return leads.find((item) => item._id === form.leadId)?.businessName
    }
    return clients.find((item) => item._id === form.clientId)?.businessName
  }, [form.targetType, form.leadId, form.clientId, leads, clients])

  useEffect(() => {
    if (form.title.trim().length > 0) return
    if (!selectedTargetLabel) return
    if (form.serviceBlocks.length === 0) return

    setForm((prev) => ({
      ...prev,
      title: `${form.serviceBlocks[0].title} for ${selectedTargetLabel}`,
    }))
  }, [selectedTargetLabel, form.serviceBlocks, form.title])

  function addBlock(template: ServiceBlockTemplate) {
    const newBlock: ProposalServiceBlock = {
      id: crypto.randomUUID(),
      serviceKey: template.key,
      title: template.title,
      description: template.description,
      deliverables: [...template.deliverables],
    }

    const newMilestones = template.defaultMilestones
      .filter((dm) => !form.milestones.some((m) => m.title === dm.title))
      .map((dm) => ({ id: crypto.randomUUID(), ...dm }))

    setForm((prev) => ({
      ...prev,
      serviceBlocks: [...prev.serviceBlocks, newBlock],
      milestones: [...prev.milestones, ...newMilestones],
    }))
    setShowBlockPicker(false)
  }

  function updateBlock(index: number, block: ProposalServiceBlock) {
    setForm((prev) => ({
      ...prev,
      serviceBlocks: prev.serviceBlocks.map((item, i) => (i === index ? block : item)),
    }))
  }

  function removeBlock(index: number) {
    const block = form.serviceBlocks[index]
    const removeTitles = new Set(
      form.milestones
        .filter((m) => m.title && block && m.title.toLowerCase().includes(block.title.split(' ')[0]?.toLowerCase() ?? ''))
        .map((m) => m.title)
    )

    setForm((prev) => ({
      ...prev,
      serviceBlocks: prev.serviceBlocks.filter((_, i) => i !== index),
      milestones: prev.milestones.filter((m) => !removeTitles.has(m.title)),
    }))
  }

  function moveBlock(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= form.serviceBlocks.length) return

    const next = [...form.serviceBlocks]
    const [item] = next.splice(index, 1)
    next.splice(targetIndex, 0, item)
    setForm((prev) => ({ ...prev, serviceBlocks: next }))
  }

  function addMilestone() {
    setForm((prev) => ({
      ...prev,
      milestones: [...prev.milestones, { id: crypto.randomUUID(), title: 'New milestone', duration: '1 week' }],
    }))
  }

  function updateMilestone(index: number, patch: Partial<ProposalMilestone>) {
    setForm((prev) => ({
      ...prev,
      milestones: prev.milestones.map((milestone, i) => (i === index ? { ...milestone, ...patch } : milestone)),
    }))
  }

  function removeMilestone(index: number) {
    setForm((prev) => ({ ...prev, milestones: prev.milestones.filter((_, i) => i !== index) }))
  }

  async function handleSave(nextStatus: ProposalStatus) {
    if (!form.title.trim()) return
    if (form.targetType === 'lead' && !form.leadId) return
    if (form.targetType === 'client' && !form.clientId) return
    if (form.serviceBlocks.length === 0) return

    setSaving(true)
    try {
      const payload = {
        title: form.title,
        status: nextStatus,
        targetType: form.targetType,
        leadId: form.targetType === 'lead' ? form.leadId : undefined,
        clientId: form.targetType === 'client' ? form.clientId : undefined,
        serviceBlocks: form.serviceBlocks,
        milestones: form.milestones,
        notes: form.notes || undefined,
        sentAt: nextStatus === 'Sent' ? new Date().toISOString() : undefined,
      }

      const endpoint = isEdit ? `/proposals/${proposal?._id}` : '/proposals'
      const method = isEdit ? 'PATCH' : 'POST'

      const data = await apiFetch<{ proposal: Proposal }>(endpoint, {
        method,
        body: JSON.stringify(payload),
      })

      onSaved(data.proposal)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-[#0a0a0a]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#111111] hover:text-[#a1a1aa]">
            <ArrowLeft size={15} />
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#3f3f46]">{isEdit ? 'Edit proposal' : 'Create proposal'}</p>
            <h2 className="text-[15px] font-semibold text-[#fafafa]">{form.title || 'Untitled proposal'}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-[#111111] px-3 py-1.5">
            <span style={{ color: statusMeta[form.status].color }}>{statusMeta[form.status].icon}</span>
            <span className="text-[12px] text-[#71717a]">{form.status}</span>
          </div>

          <button onClick={() => handleSave('Draft')} disabled={saving} className="rounded-lg px-3 py-1.5 text-[13px] text-[#52525b] hover:text-[#a1a1aa]">
            Save draft
          </button>

          <button
            onClick={() => onPreview({
              ...(proposal ?? { _id: 'temp', proposalNumber: 'PREVIEW', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: { _id: 'me', name: 'You', initials: 'YU' } }),
              title: form.title || 'Untitled proposal',
              status: form.status,
              targetType: form.targetType,
              lead: form.targetType === 'lead' ? (leads.find((l) => l._id === form.leadId) as any) : undefined,
              client: form.targetType === 'client' ? (clients.find((c) => c._id === form.clientId) as any) : undefined,
              serviceBlocks: form.serviceBlocks,
              milestones: form.milestones,
              notes: form.notes,
            })}
            className="flex items-center gap-1.5 rounded-lg bg-[#111111] px-3 py-1.5 text-[13px] text-[#a1a1aa] hover:bg-[#1a1a1a]"
          >
            <Eye size={13} />
            Preview
          </button>

          {form.status === 'Draft' && (
            <button onClick={() => handleSave('Sent')} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4f46e5] disabled:opacity-60">
              <Send size={13} />
              Mark as sent
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-6">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Proposal for</p>

          <div className="flex w-fit items-center gap-1 rounded-xl bg-[#111111] p-1">
            {(['lead', 'client'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setForm((prev) => ({ ...prev, targetType: type, leadId: '', clientId: '' }))}
                className={`rounded-lg px-3 py-1.5 text-[12px] capitalize transition-colors ${
                  form.targetType === type ? 'bg-[#1a1a1a] text-[#fafafa]' : 'text-[#52525b] hover:text-[#a1a1aa]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Proposal title"
            className="w-full rounded-xl bg-[#111111] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />

          <select
            value={form.targetType === 'lead' ? form.leadId : form.clientId}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                leadId: prev.targetType === 'lead' ? e.target.value : '',
                clientId: prev.targetType === 'client' ? e.target.value : '',
              }))
            }
            className="w-full rounded-xl bg-[#111111] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">Select {form.targetType}...</option>
            {(form.targetType === 'lead' ? leads : clients).map((item) => (
              <option key={item._id} value={item._id}>
                {item.businessName} - {item.ownerName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Scope of work</p>
            <button onClick={() => setShowBlockPicker(true)} className="flex items-center gap-1.5 text-[12px] text-[#6366f1] hover:text-[#818cf8]">
              <Plus size={12} />
              Add service
            </button>
          </div>

          {form.serviceBlocks.length === 0 && (
            <button onClick={() => setShowBlockPicker(true)} className="w-full rounded-2xl border-2 border-dashed border-[#1f1f1f] p-8 text-center text-[13px] text-[#3f3f46] hover:border-[#2a2a2a]">
              Click to add a service block
            </button>
          )}

          {form.serviceBlocks.map((block, index) => (
            <div key={block.id} className="space-y-4 rounded-2xl bg-[#111111] p-5">
              <div className="flex items-center gap-3">
                <input
                  value={block.title}
                  onChange={(e) => updateBlock(index, { ...block, title: e.target.value })}
                  className="flex-1 border-b border-transparent bg-transparent pb-0.5 text-[14px] font-semibold text-[#fafafa] outline-none focus:border-[#2a2a2a]"
                />
                <div className="flex items-center gap-1">
                  <button onClick={() => moveBlock(index, 'up')} className="flex size-6 items-center justify-center rounded text-[#3f3f46] hover:text-[#52525b]">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => moveBlock(index, 'down')} className="flex size-6 items-center justify-center rounded text-[#3f3f46] hover:text-[#52525b]">
                    <ChevronDown size={13} />
                  </button>
                  <button onClick={() => removeBlock(index)} className="flex size-6 items-center justify-center rounded text-[#3f3f46] hover:text-[#ef4444]">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <textarea
                value={block.description}
                onChange={(e) => updateBlock(index, { ...block, description: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-[13px] leading-relaxed text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
              />

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-widest text-[#3f3f46]">Deliverables</p>
                {block.deliverables.map((item, i) => (
                  <div key={`${block.id}-${i}`} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#3f3f46]">-</span>
                    <input
                      value={item}
                      onChange={(e) => {
                        const next = [...block.deliverables]
                        next[i] = e.target.value
                        updateBlock(index, { ...block, deliverables: next })
                      }}
                      className="flex-1 rounded-lg bg-[#1a1a1a] px-2.5 py-1.5 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
                    />
                    <button
                      onClick={() => updateBlock(index, { ...block, deliverables: block.deliverables.filter((_, idx) => idx !== i) })}
                      className="flex size-6 items-center justify-center rounded text-[#3f3f46] hover:text-[#ef4444]"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => updateBlock(index, { ...block, deliverables: [...block.deliverables, ''] })}
                  className="mt-1 flex items-center gap-1 text-[11px] text-[#3f3f46] hover:text-[#52525b]"
                >
                  <Plus size={11} /> Add deliverable
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">Timeline</p>
            <button onClick={addMilestone} className="flex items-center gap-1.5 text-[12px] text-[#6366f1] hover:text-[#818cf8]">
              <Plus size={12} />
              Add milestone
            </button>
          </div>

          {form.milestones.map((milestone, index) => (
            <div key={milestone.id} className="group flex items-center gap-3 rounded-xl bg-[#111111] px-3 py-2.5">
              <span className="w-4 shrink-0 font-['Geist_Mono'] text-[11px] text-[#3f3f46]">{index + 1}</span>
              <input
                value={milestone.title}
                onChange={(e) => updateMilestone(index, { title: e.target.value })}
                className="flex-1 bg-transparent text-[13px] text-[#a1a1aa] outline-none"
              />
              <input
                value={milestone.duration}
                onChange={(e) => updateMilestone(index, { duration: e.target.value })}
                className="w-30 rounded-lg bg-[#1a1a1a] px-2 py-1.5 text-[12px] text-[#a1a1aa] outline-none"
              />
              <button onClick={() => removeMilestone(index)} className="flex size-6 items-center justify-center rounded text-[#3f3f46] hover:text-[#ef4444]">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
            Internal notes <span className="ml-2 normal-case text-[#2a2a2a]">- not shown in proposal PDF</span>
          </p>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            placeholder="Notes visible only to your team..."
            className="w-full resize-none rounded-xl bg-[#111111] px-3 py-2.5 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>
      </div>

      <ServiceBlockPicker
        isOpen={showBlockPicker}
        onClose={() => setShowBlockPicker(false)}
        addedKeys={form.serviceBlocks.map((block) => block.serviceKey)}
        onAdd={addBlock}
      />
    </div>
  )
}
