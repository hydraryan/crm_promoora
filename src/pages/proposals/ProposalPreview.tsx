import { useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock, Download, Edit3, Printer, XCircle } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { type Proposal, type ProposalStatus } from '@/utils/proposalConstants'
import { ProposalDocument } from './ProposalDocument'
import AcceptProposalModal from './AcceptProposalModal'
import './proposalPrint.css'

interface ProposalPreviewProps {
  proposal: Proposal
  role: string
  onClose: () => void
  onEdit: () => void
  onUpdated: (proposal: Proposal) => void
}

export default function ProposalPreview({ proposal, role, onClose, onEdit, onUpdated }: ProposalPreviewProps) {
  const [working, setWorking] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const documentRef = useRef<HTMLDivElement | null>(null)

  const canManage = role === 'admin' || role === 'bd_intern'

  async function updateStatus(status: ProposalStatus, extra?: Record<string, unknown>) {
    setWorking(true)
    try {
      const updated = await apiFetch<{ proposal: Proposal }>(`/proposals/${proposal._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...extra }),
      })
      onUpdated(updated.proposal)
    } finally {
      setWorking(false)
    }
  }

  async function downloadPdf() {
    if (!documentRef.current) return

    setDownloading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      if (typeof document !== 'undefined' && 'fonts' in document) {
        await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready
      }

      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: -window.scrollY,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const fileName = `${proposal.proposalNumber || 'proposal'}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Proposal PDF download failed:', error)
      window.alert('Unable to download PDF right now. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0a0a]">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-[#52525b] hover:bg-[#111111]">
            <ArrowLeft size={15} />
          </button>
          <p className="font-['Geist_Mono'] text-[13px] text-[#52525b]">{proposal.proposalNumber}</p>
        </div>

        <div className="flex items-center gap-2">
          {proposal.status === 'Sent' && canManage && (
            <button
              onClick={() => updateStatus('Awaiting response')}
              disabled={working}
              className="flex items-center gap-1.5 rounded-lg bg-[#f59e0b]/15 px-3 py-1.5 text-[12px] text-[#f59e0b]"
            >
              <Clock size={12} />
              Awaiting response
            </button>
          )}

          {proposal.status === 'Awaiting response' && canManage && (
            <>
              <button onClick={() => setAcceptOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-[#22c55e]/15 px-3 py-1.5 text-[12px] text-[#22c55e]">
                <CheckCircle2 size={12} />
                Mark accepted
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt('Reason for rejection (optional)')
                  updateStatus('Rejected', { rejectionReason: reason || undefined, rejectedAt: new Date().toISOString() })
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#ef4444]/15 px-3 py-1.5 text-[12px] text-[#ef4444]"
              >
                <XCircle size={12} />
                Mark rejected
              </button>
            </>
          )}

          {proposal.status === 'Draft' && (
            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg bg-[#111111] px-3 py-1.5 text-[12px] text-[#a1a1aa] hover:bg-[#1a1a1a]">
              <Edit3 size={12} />
              Edit
            </button>
          )}

          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-[#4f46e5]">
            <Printer size={12} />
            Save as PDF
          </button>

          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg bg-[#111111] px-4 py-1.5 text-[12px] font-medium text-[#a1a1aa] hover:bg-[#1a1a1a] disabled:opacity-60"
          >
            <Download size={12} />
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div ref={documentRef} className="mx-auto my-8 max-w-198.5 overflow-hidden rounded-lg shadow-2xl proposal-document">
        <ProposalDocument proposal={proposal} />
      </div>

      <AcceptProposalModal
        isOpen={acceptOpen}
        proposal={proposal}
        onClose={() => setAcceptOpen(false)}
        onSuccess={async () => {
          setAcceptOpen(false)
          const fresh = await apiFetch<{ proposal: Proposal }>(`/proposals/${proposal._id}`)
          onUpdated(fresh.proposal)
        }}
      />
    </div>
  )
}
