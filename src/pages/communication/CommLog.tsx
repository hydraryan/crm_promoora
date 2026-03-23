import { useEffect, useMemo, useState } from 'react'
import { Building2, Search, UserCircle } from 'lucide-react'
import { CommEntryRow } from '@/pages/communication/CommEntryRow'
import { apiFetch } from '@/utils/apiFetch'
import {
  channelMeta,
  COMM_CHANNELS,
  deriveChannel,
  groupBy,
  type CommChannel,
  type CommEntry,
  type Outcome,
  type PaginatedResponse,
  type TeamMemberOption,
} from '@/utils/commConstants'
import type { Role } from '@/utils/teamConstants'

interface CommLogProps {
  role: Role
  userId: string
  defaultChannel?: CommChannel
  groupBy?: 'client' | 'member' | 'date'
  titleOverride?: string
}

export default function CommLog({ role, userId, defaultChannel, groupBy: groupMode, titleOverride }: CommLogProps) {
  const [entries, setEntries] = useState<CommEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeChannel, setActiveChannel] = useState<CommChannel>(defaultChannel ?? 'all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actorFilter, setActorFilter] = useState(role !== 'admin' ? userId : '')
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [channelCounts, setChannelCounts] = useState<Partial<Record<CommChannel, number>>>({})

  useEffect(() => {
    if (!defaultChannel) return
    setActiveChannel(defaultChannel)
  }, [defaultChannel])

  useEffect(() => {
    if (role !== 'admin') return

    let active = true
    apiFetch<{ members: Array<{ _id: string; name: string }> }>('/team/members')
      .then((data) => {
        if (active) setTeamMembers((data.members ?? []).map((m) => ({ _id: m._id, name: m.name })))
      })
      .catch(() => {
        if (active) setTeamMembers([])
      })

    return () => {
      active = false
    }
  }, [role])

  const fetchEntries = async (pageToLoad: number): Promise<PaginatedResponse<CommEntry>> => {
    const params = new URLSearchParams()
    params.set('page', String(pageToLoad))
    params.set('pageSize', '30')

    if (activeChannel && activeChannel !== 'all') params.set('channel', activeChannel)
    if (actorFilter) params.set('actorId', actorFilter)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (search.trim()) params.set('search', search.trim())

    const response = await apiFetch<PaginatedResponse<CommEntry>>(`/communication/log?${params.toString()}`)

    const normalized = response.items.map((entry) => ({ ...entry, channel: deriveChannel(entry) }))
    const counts: Partial<Record<CommChannel, number>> = {}
    COMM_CHANNELS.forEach((channel) => {
      counts[channel] = channel === 'all' ? normalized.length : normalized.filter((entry) => entry.channel === channel).length
    })

    setChannelCounts(counts)

    return {
      ...response,
      items: normalized,
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setPage(1)
    setEntries([])

    fetchEntries(1)
      .then((data) => {
        if (!active) return
        setEntries(data.items)
        setTotal(data.total)
        setHasMore(data.hasMore)
      })
      .catch(() => {
        if (active) setError('Failed to load communication logs')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeChannel, actorFilter, dateFrom, dateTo, search])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const data = await fetchEntries(nextPage)
      setEntries((prev) => [...prev, ...data.items])
      setPage(nextPage)
      setHasMore(data.hasMore)
      setTotal(data.total)
    } catch {
      setError('Failed to load more logs')
    } finally {
      setLoadingMore(false)
    }
  }

  async function updateOutcome(entryId: string, outcome: Outcome) {
    try {
      await apiFetch(`/communication/log/${entryId}/outcome`, {
        method: 'PATCH',
        body: JSON.stringify({ outcome }),
      })
      setEntries((prev) => prev.map((entry) => (entry._id === entryId ? { ...entry, outcome } : entry)))
    } catch {
      setError('Unable to update outcome')
    }
  }

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    if (role === 'admin') setActorFilter('')
  }

  const canUpdateOutcome = (entry: CommEntry) => role === 'admin' || entry.actor._id === userId

  const groupedByClient = useMemo(() => (groupMode === 'client' ? groupBy(entries, (entry) => entry.target._id) : {}), [entries, groupMode])
  const groupedByMember = useMemo(() => (groupMode === 'member' ? groupBy(entries, (entry) => entry.actor._id) : {}), [entries, groupMode])
  const groupedByDate = useMemo(
    () =>
      groupMode === 'date'
        ? groupBy(entries, (entry) => new Date(entry.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
        : {},
    [entries, groupMode],
  )

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-full space-y-4 bg-[#0a0a0a] px-8 py-7">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#111111]" />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#0a0a0a] px-8 py-7">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[#404040]">Communication</p>
          <h1 className="text-[22px] font-semibold text-[#fafafa]">
            {titleOverride ?? 'All communications'}
            <span className="ml-3 font-['Geist_Mono'] text-[14px] font-normal text-[#52525b]">{total}</span>
            {defaultChannel && (
              <span className="ml-3 inline-flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-2 py-0.5 align-middle">
                {(() => {
                  const Icon = channelMeta[defaultChannel].icon
                  return (
                    <>
                      <span style={{ color: channelMeta[defaultChannel].color }}>
                        <Icon size={12} />
                      </span>
                      <span className="text-[11px] text-[#71717a]">{channelMeta[defaultChannel].label}</span>
                    </>
                  )
                })()}
              </span>
            )}
          </h1>
        </div>
      </div>

      {!defaultChannel && (
        <div className="mb-5 flex items-center gap-1 overflow-x-auto pb-1">
          {COMM_CHANNELS.map((channel) => {
            const Icon = channelMeta[channel].icon
            const isActive = activeChannel === channel
            return (
              <button
                key={channel}
                onClick={() => setActiveChannel(channel)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[12px] transition-colors duration-150 ${
                  isActive ? 'bg-[#1a1a1a] text-[#fafafa]' : 'text-[#3f3f46] hover:text-[#52525b]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5" style={{ color: isActive ? channelMeta[channel].color : undefined }}>
                  <Icon size={13} />
                  <span>{channelMeta[channel].label}</span>
                </span>
                <span className="ml-1 font-['Geist_Mono'] text-[10px] text-[#3f3f46]">{channelCounts[channel] ?? ''}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3f3f46]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by business name..."
            className="w-full rounded-xl bg-[#111111] py-2 pl-8 pr-3 text-[13px] text-[#a1a1aa] outline-none placeholder:text-[#3f3f46] focus:ring-1 focus:ring-[#6366f1]"
          />
        </div>

        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="rounded-xl bg-[#111111] px-3 py-2 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="rounded-xl bg-[#111111] px-3 py-2 text-[12px] text-[#a1a1aa] outline-none focus:ring-1 focus:ring-[#6366f1]"
        />

        {role === 'admin' && (
          <select
            value={actorFilter}
            onChange={(event) => setActorFilter(event.target.value)}
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

        {(dateFrom || dateTo || actorFilter || search) && (
          <button onClick={clearFilters} className="text-[12px] text-[#3f3f46] transition-colors hover:text-[#52525b]">
            Clear
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-[12px] text-[#ef4444]">{error}</p>}

      {!groupMode && (
        <div className="space-y-px" id="entries-list">
          {entries.map((entry) => (
            <CommEntryRow
              key={entry._id}
              entry={entry}
              showActor={role === 'admin' || actorFilter !== userId}
              onOutcomeChange={canUpdateOutcome(entry) ? (outcome) => updateOutcome(entry._id, outcome) : undefined}
            />
          ))}
        </div>
      )}

      {groupMode === 'client' && (
        <div>
          {Object.entries(groupedByClient).map(([targetId, groupEntries]) => {
            const target = groupEntries[0].target
            return (
              <div key={targetId} className="mb-6">
                <div className="mb-1 flex items-center gap-2 px-3 py-2">
                  <span className="text-[#3f3f46]">{target.targetType === 'lead' ? <UserCircle size={12} /> : <Building2 size={12} />}</span>
                  <p className="text-[12px] font-medium text-[#71717a]">{target.name}</p>
                  <span className="font-['Geist_Mono'] text-[11px] text-[#2a2a2a]">{groupEntries.length}</span>
                  <span className="ml-1 text-[10px] capitalize text-[#2a2a2a]">{target.targetType}</span>
                </div>

                {groupEntries.map((entry) => (
                  <CommEntryRow
                    key={entry._id}
                    entry={entry}
                    showActor={role === 'admin'}
                    onOutcomeChange={canUpdateOutcome(entry) ? (outcome) => updateOutcome(entry._id, outcome) : undefined}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {groupMode === 'member' && (
        <div>
          {Object.entries(groupedByMember).map(([actorId, groupEntries]) => {
            const actor = groupEntries[0].actor
            return (
              <div key={actorId} className="mb-6">
                <div className="mb-1 flex items-center gap-2 px-3 py-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a]">
                    <span className="text-[8px] text-[#71717a]">{actor.initials}</span>
                  </div>
                  <p className="text-[12px] font-medium text-[#71717a]">{actor.name}</p>
                  <span className="font-['Geist_Mono'] text-[11px] text-[#2a2a2a]">{groupEntries.length}</span>
                </div>

                {groupEntries.map((entry) => (
                  <CommEntryRow
                    key={entry._id}
                    entry={entry}
                    showActor={false}
                    onOutcomeChange={canUpdateOutcome(entry) ? (outcome) => updateOutcome(entry._id, outcome) : undefined}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {groupMode === 'date' && (
        <div>
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, groupEntries]) => {
              const d = new Date(`${date}T00:00:00`)
              const today = new Date()
              const yesterday = new Date(today)
              yesterday.setDate(today.getDate() - 1)

              const label =
                d.toDateString() === today.toDateString()
                  ? 'Today'
                  : d.toDateString() === yesterday.toDateString()
                    ? 'Yesterday'
                    : d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

              return (
                <div key={date} className="mb-6">
                  <div className="mb-1 flex items-center gap-3 px-3 py-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-[#3f3f46]">{label}</p>
                    <div className="h-px flex-1 bg-[#1a1a1a]" />
                    <span className="font-['Geist_Mono'] text-[11px] text-[#2a2a2a]">{groupEntries.length}</span>
                  </div>

                  {groupEntries.map((entry) => (
                    <CommEntryRow
                      key={entry._id}
                      entry={entry}
                      showActor={role === 'admin'}
                      onOutcomeChange={canUpdateOutcome(entry) ? (outcome) => updateOutcome(entry._id, outcome) : undefined}
                    />
                  ))}
                </div>
              )
            })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 w-full rounded-xl bg-[#111111] py-3 text-[13px] text-[#52525b] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-[#a1a1aa]"
        >
          {loadingMore ? 'Loading...' : `Load more . ${Math.max(total - entries.length, 0)} remaining`}
        </button>
      )}

      {entries.length === 0 && !loading && (
        <div className="py-16 text-center">
          <p className="text-sm text-[#3f3f46]">No communication logs found</p>
          {(dateFrom || dateTo || search) && (
            <button onClick={clearFilters} className="mt-2 text-sm text-[#6366f1] hover:text-[#818cf8]">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
