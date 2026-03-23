import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { apiFetch } from '@/utils/apiFetch'
import { businessTypeIcons, BUSINESS_TYPES, CLIENT_STATUSES, statusDot, type BusinessType, type Client, type ClientStatus } from '@/utils/clientConstants'
import NewClientModal from './NewClientModal'
import ClientDetailDrawer from './ClientDetailDrawer'

interface AllClientsProps {
  defaultStatus?: ClientStatus
  defaultBusinessType?: BusinessType
  titleOverride?: string
  openNewClientModal?: boolean
}

export default function AllClients({ defaultStatus, defaultBusinessType, titleOverride, openNewClientModal }: AllClientsProps) {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_user') ?? '{}') as {
        role?: string
      }
    } catch {
      return {}
    }
  }, [])

  const role = storedUser.role ?? 'viewer'

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatus ?? '')
  const [typeFilter, setTypeFilter] = useState<string>(defaultBusinessType ?? '')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [teamMembers, setTeamMembers] = useState<Array<{ _id: string; name: string; initials: string }>>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [showNewClientModal, setShowNewClientModal] = useState(Boolean(openNewClientModal))
  const [endpointUnavailable, setEndpointUnavailable] = useState(false)

  useEffect(() => {
    setShowNewClientModal(Boolean(openNewClientModal))
  }, [openNewClientModal])

  useEffect(() => {
    setStatusFilter(defaultStatus ?? '')
  }, [defaultStatus])

  useEffect(() => {
    setTypeFilter(defaultBusinessType ?? '')
  }, [defaultBusinessType])

  const refetch = async () => {
    setLoading(true)
    setError(null)
    setEndpointUnavailable(false)

    try {
      const [clientRes, teamRes] = await Promise.all([
        apiFetch<{ clients: Client[]; total: number }>('/clients'),
        role === 'admin'
          ? apiFetch<{ members: Array<{ _id: string; name: string; initials?: string }> }>('/team/members').catch(() => ({ members: [] }))
          : Promise.resolve({ members: [] as Array<{ _id: string; name: string; initials?: string }> }),
      ])

      setClients(clientRes.clients)
      setTeamMembers(teamRes.members.map((member) => ({ _id: member._id, name: member.name, initials: member.initials ?? member.name.slice(0, 2).toUpperCase() })))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load clients'
      if (message.includes('404') && message.includes('/clients')) {
        setEndpointUnavailable(true)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  const filteredClients = clients.filter((client) => {
    const matchSearch =
      !search ||
      client.businessName.toLowerCase().includes(search.toLowerCase()) ||
      client.ownerName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || client.status === statusFilter
    const matchType = !typeFilter || client.businessType === typeFilter
    const matchAssigned = !assignedFilter || client.assignedTo._id === assignedFilter
    return matchSearch && matchStatus && matchType && matchAssigned
  })

  if (loading)
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#111111]" />
        ))}
      </div>
    )

  if (error)
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0a] px-8 py-7">
        <div className="space-y-2 text-center">
          <p className="text-sm text-[#52525b]">{error}</p>
          <button onClick={refetch} className="text-sm text-[#6366f1] hover:text-[#818cf8]">
            Try again
          </button>
        </div>
      </div>
    )

  if (endpointUnavailable)
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0a0a0a] px-8 py-7">
        <p className="text-sm text-[#52525b]">Endpoint not available yet. Expected: GET /api/clients</p>
      </div>
    )

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Clients</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            {titleOverride ?? 'All clients'}
            <span className="ml-3 font-['Geist_Mono'] text-[14px] font-normal text-[#52525b]">{filteredClients.length}</span>
          </h1>
        </div>

        {role === 'admin' && (
          <button
            onClick={() => setShowNewClientModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#4f46e5]"
          >
            <Plus size={14} />
            Add client
          </button>
        )}
      </div>

      {defaultStatus === 'Inactive' && (
        <p className="-mt-4 mb-5 text-[12px] text-[#52525b]">
          <span className="font-['Geist_Mono'] text-[#71717a]">{filteredClients.length}</span> inactive clients - consider a win-back outreach
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3f3f46]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business or owner..."
            className="w-full rounded-xl bg-[#111111] py-2 pl-8 pr-3 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>

        {!defaultStatus && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">All statuses</option>
            {CLIENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        )}

        {!defaultBusinessType && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">All types</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )}

        {role === 'admin' && (
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-xl bg-[#111111] px-3 py-2 text-[13px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
          >
            <option value="">All members</option>
            {teamMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {member.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-1 grid grid-cols-[1fr_160px_120px_150px_140px_90px_32px] gap-4 px-3 py-2">
        {['Business', 'Owner', 'Status', 'Type', 'Assigned', 'Since', ''].map((col) => (
          <p key={col} className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">
            {col}
          </p>
        ))}
      </div>

      {filteredClients.map((client) => (
        <div
          key={client._id}
          onClick={() => setSelectedClientId(client._id)}
          className="group grid cursor-pointer grid-cols-[1fr_160px_120px_150px_140px_90px_32px] gap-4 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] text-[#a1a1aa] transition-colors duration-100 group-hover:text-[#fafafa]">{client.businessName}</p>
          </div>

          <p className="truncate text-[13px] text-[#52525b]">{client.ownerName}</p>

          <div className="flex items-center gap-1.5">
            {statusDot(client.status)}
            <span className="text-[12px] text-[#71717a]">{client.status}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#52525b]">{businessTypeIcons[client.businessType]}</span>
            <span className="text-[12px] text-[#71717a]">{client.businessType}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
              <span className="text-[9px] text-[#71717a]">{client.assignedTo.initials}</span>
            </div>
            <p className="truncate text-[12px] text-[#52525b]">{client.assignedTo.name}</p>
          </div>

          <p className="font-['Geist_Mono'] text-[11px] text-[#3f3f46]">
            {client.activeFrom ? new Date(client.activeFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
          </p>

          <ChevronRight size={13} className="text-[#3f3f46] transition-colors duration-100 group-hover:text-[#52525b]" />
        </div>
      ))}

      {filteredClients.length === 0 && !loading && (
        <div className="py-16 text-center">
          <p className="text-sm text-[#3f3f46]">No clients match your filters</p>
        </div>
      )}

      {defaultStatus === 'Onboarding' && (
        <div className="mt-4 rounded-2xl bg-[#111111] p-5">
          <p className="mb-4 text-[13px] font-medium text-[#a1a1aa]">Onboarding progress</p>
          <div className="space-y-px">
            {filteredClients.map((client) => (
              <div key={client._id} className="flex items-center gap-4 rounded-xl px-3 py-2.5 hover:bg-[#1a1a1a]">
                <p className="flex-1 truncate text-[13px] text-[#a1a1aa]">{client.businessName}</p>

                <div className="flex items-center gap-1">
                  {client.services.map((service) => (
                    <span key={service} className="rounded-md bg-[#1a1a1a] px-2 py-0.5 text-[10px] text-[#52525b]">
                      {service}
                    </span>
                  ))}
                </div>

                {client.onboardingStartedAt && (
                  <p className="shrink-0 font-['Geist_Mono'] text-[11px] text-[#52525b]">
                    Day {Math.floor((Date.now() - new Date(client.onboardingStartedAt).getTime()) / 86400000)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <NewClientModal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        onCreated={() => {
          refetch()
          setShowNewClientModal(false)
        }}
      />

      <ClientDetailDrawer
        clientId={selectedClientId}
        onClose={() => setSelectedClientId(null)}
        onUpdated={() => {
          refetch()
        }}
      />
    </div>
  )
}
