import { Plus, X } from 'lucide-react'
import { SERVICE_BLOCKS, type ServiceBlockTemplate } from '@/utils/proposalConstants'

interface ServiceBlockPickerProps {
  isOpen: boolean
  onClose: () => void
  addedKeys: string[]
  onAdd: (template: ServiceBlockTemplate) => void
}

export default function ServiceBlockPicker({ isOpen, onClose, addedKeys, onAdd }: ServiceBlockPickerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex w-140 max-h-[80vh] flex-col rounded-2xl border border-[#1f1f1f] bg-[#111111]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#fafafa]">Add service</h2>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#1a1a1a]">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {SERVICE_BLOCKS.map((template) => {
            const alreadyAdded = addedKeys.includes(template.key)
            return (
              <button
                key={template.key}
                disabled={alreadyAdded}
                onClick={() => onAdd(template)}
                className={`w-full rounded-xl border p-3 text-left transition-colors duration-150 ${
                  alreadyAdded
                    ? 'cursor-not-allowed border-[#1f1f1f] bg-[#0f0f0f] text-[#3f3f46]'
                    : 'border-[#1f1f1f] bg-[#111111] hover:bg-[#1a1a1a]'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className={`text-[13px] font-medium ${alreadyAdded ? 'text-[#52525b]' : 'text-[#fafafa]'}`}>{template.title}</p>
                  <span className={`flex items-center gap-1 text-[11px] ${alreadyAdded ? 'text-[#3f3f46]' : 'text-[#6366f1]'}`}>
                    <Plus size={11} />
                    {alreadyAdded ? 'Added' : 'Add'}
                  </span>
                </div>
                <p className={`line-clamp-2 text-[12px] ${alreadyAdded ? 'text-[#3f3f46]' : 'text-[#71717a]'}`}>{template.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
