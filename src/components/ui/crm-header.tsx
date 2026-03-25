import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  ChevronDown,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LogOut,
  Menu,
  Search,
  Sun,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/utils/teamConstants'
import { apiFetch } from '@/utils/apiFetch'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import { useTheme } from '@/context/ThemeContext'
import { ThemeSwitch } from '@/components/ui/theme-switch-button'

interface CRMHeaderProps {
  isDetailCollapsed: boolean
  onToggleCollapse: () => void
  onLogoClick: () => void
  activeSection: string
  userName: string
  userInitials: string
  role: Role
  onSearchNavigate: (actionUrl?: string) => void
  onNotificationNavigate: (actionUrl?: string) => void
  onViewProfile: () => void
  onSignOut: () => void
}

interface WeatherState {
  temperatureC: number
  weatherCode: number
}

interface WeatherPresentation {
  label: string
  Icon: LucideIcon
}

interface HeaderNotification {
  _id: string
  category: 'lead' | 'followup' | 'team' | 'system'
  title: string
  message: string
  actionUrl?: string
  isRead: boolean
  createdAt: string
}

type UniversalSearchResult = {
  id: string
  type: 'lead' | 'client' | 'project' | 'proposal' | 'followup' | 'invoice' | 'team-member'
  title: string
  subtitle: string
  meta?: string
  actionUrl: string
}

function describeWeather(code: number): WeatherPresentation {
  if (code === 0) return { label: 'clear sky', Icon: Sun }
  if (code === 1 || code === 2) return { label: 'partly cloudy', Icon: CloudSun }
  if (code === 3) return { label: 'overcast', Icon: Cloud }
  if (code === 45 || code === 48) return { label: 'fog', Icon: CloudFog }
  if (code >= 51 && code <= 67) return { label: 'drizzle / rain', Icon: CloudRain }
  if (code >= 71 && code <= 77) return { label: 'snow', Icon: CloudSnow }
  if (code >= 80 && code <= 82) return { label: 'rain showers', Icon: CloudRain }
  if (code >= 85 && code <= 86) return { label: 'snow showers', Icon: CloudSnow }
  if (code >= 95) return { label: 'thunderstorm', Icon: CloudLightning }
  return { label: 'cloudy', Icon: Cloud }
}

export function CRMHeader({
  isDetailCollapsed,
  onToggleCollapse,
  onLogoClick,
  activeSection,
  userName,
  userInitials,
  onSearchNavigate,
  onNotificationNavigate,
  onViewProfile,
  onSignOut,
}: CRMHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const [now, setNow] = useState<Date>(new Date())
  const [weather, setWeather] = useState<WeatherState | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<HeaderNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<UniversalSearchResult[]>([])
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius&timezone=auto`
        )
        if (!response.ok) return
        const data = (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number }
        }
        if (cancelled || !data.current) return
        if (typeof data.current.temperature_2m !== 'number' || typeof data.current.weather_code !== 'number') return

        setWeather({
          temperatureC: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
        })
      } catch {
        // No-op: weather is optional UI.
      }
    }

    const requestLocation = () => {
      if (!('geolocation' in navigator)) return
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          void fetchWeather(latitude, longitude)
        },
        () => {
          // Ignore denied location; date still works.
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
      )
    }

    requestLocation()
    const weatherTimer = window.setInterval(requestLocation, 10 * 60_000)

    return () => {
      cancelled = true
      window.clearInterval(weatherTimer)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadNotifications = async () => {
      setIsLoadingNotifications(true)
      try {
        const data = await apiFetch<{ notifications: HeaderNotification[]; unreadCount: number }>('/notifications?limit=20')
        if (!mounted) return
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      } catch {
        if (!mounted) return
        setNotifications([])
        setUnreadCount(0)
      } finally {
        if (mounted) {
          setIsLoadingNotifications(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('crm_access_token')
    if (!token) return

    const apiBase = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
    const streamUrl = `${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`
    const source = new EventSource(streamUrl)

    source.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          notification?: HeaderNotification
          unreadCount?: number
        }
        if (!payload.notification) return

        setNotifications((previous) => {
          const deduped = previous.filter((item) => item._id !== payload.notification?._id)
          return [payload.notification as HeaderNotification, ...deduped].slice(0, 20)
        })

        if (typeof payload.unreadCount === 'number') {
          setUnreadCount(payload.unreadCount)
        }
      } catch {
        // Ignore malformed events.
      }
    })

    source.addEventListener('unread-count', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { unreadCount?: number }
        if (typeof payload.unreadCount === 'number') {
          setUnreadCount(payload.unreadCount)
        }
      } catch {
        // Ignore malformed events.
      }
    })

    return () => source.close()
  }, [])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey
      if (!isCmdOrCtrl || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setIsSearchOpen(true)
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [searchInputRef])

  useEffect(() => {
    if (!isSearchOpen) return

    const timer = window.setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        setIsSearchLoading(false)
        return
      }

      setIsSearchLoading(true)
      try {
        const response = await apiFetch<{ results: UniversalSearchResult[] }>(`/search?q=${encodeURIComponent(searchQuery.trim())}&limit=6`)
        setSearchResults(response.results ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setIsSearchLoading(false)
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [searchQuery, isSearchOpen])

  useEffect(() => {
    if (!isMenuOpen) return

    const onWindowClick = () => setIsMenuOpen(false)
    window.addEventListener('click', onWindowClick)
    return () => window.removeEventListener('click', onWindowClick)
  }, [isMenuOpen])

  useEffect(() => {
    if (!isNotificationsOpen) return

    const onWindowClick = () => setIsNotificationsOpen(false)
    window.addEventListener('click', onWindowClick)
    return () => window.removeEventListener('click', onWindowClick)
  }, [isNotificationsOpen])

  useEffect(() => {
    if (!isSearchOpen) return

    const onWindowClick = () => setIsSearchOpen(false)
    window.addEventListener('click', onWindowClick)
    return () => window.removeEventListener('click', onWindowClick)
  }, [isSearchOpen])

  const dateLine = useMemo(
    () =>
      now
        .toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        })
        .toUpperCase(),
    [now]
  )

  const weatherDisplay = weather ? describeWeather(weather.weatherCode) : null

  const markOneAsRead = async (id: string) => {
    try {
      await apiFetch<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications((previous) => previous.map((item) => (item._id === id ? { ...item, isRead: true } : item)))
      setUnreadCount((previous) => Math.max(0, previous - 1))
    } catch {
      // Ignore one-off failures to keep header interaction responsive.
    }
  }

  const markAllAsRead = async () => {
    try {
      await apiFetch<{ success: boolean }>('/notifications/mark-all-read', { method: 'POST' })
      setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch {
      // Ignore one-off failures to keep header interaction responsive.
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b border-border bg-card text-card-foreground transition-colors duration-300">
      <div className="relative z-10 flex h-full w-86 shrink-0 items-center gap-2 px-3">
        <button
          type="button"
          onClick={onLogoClick}
          className="shrink-0 cursor-pointer rounded-md transition-all duration-150 hover:opacity-90 hover:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          aria-label="Go to dashboard"
        >
          <img
            src={theme === 'light' ? '/logos/promoora-crm-light.svg' : '/logos/promoora-crm-compact.svg'}
            alt="Promoora"
            className="h-10 w-auto shrink-0"
          />
        </button>
        <button
          onClick={onToggleCollapse}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          type="button"
          aria-label={isDetailCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={15} />
        </button>
      </div>

      <div className="hidden md:flex shrink-0 items-center rounded-xl border border-border px-3 py-1.5 text-xs text-foreground">
        <div className="pr-3 leading-tight">
          <p className="font-medium tracking-[0.06em]">{dateLine}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="pl-3 leading-tight">
          {weatherDisplay && weather ? (
            <>
              <p className="font-medium">{Math.round(weather.temperatureC)}°C</p>
              <p className="flex items-center gap-1 text-muted-foreground">
                <weatherDisplay.Icon size={12} />
                <span>{weatherDisplay.label}</span>
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">--°C</p>
              <p className="text-muted-foreground">waiting location...</p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end px-5">
        <div className="flex items-center gap-2">
          <div className="relative hidden lg:block">
            <div
              className="flex h-8 w-64 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 focus-within:border-muted-foreground/50"
              onClick={(event) => event.stopPropagation()}
            >
              <Search size={13} className="shrink-0" />
              <input
                ref={(el) => {
                  searchInputRef.current = el
                }}
                type="text"
                value={searchQuery}
                onFocus={() => {
                  setIsSearchOpen(true)
                  setIsMenuOpen(false)
                  setIsNotificationsOpen(false)
                }}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  if (!isSearchOpen) {
                    setIsSearchOpen(true)
                  }
                }}
                placeholder="Search everything..."
                className="h-full w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl/Cmd + K</span>
            </div>

            {isSearchOpen && (
              <div
                className="absolute left-0 top-10 z-50 w-120 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="max-h-96 overflow-y-auto">
                  {searchQuery.trim().length < 2 ? (
                    <p className="px-3 py-5 text-center text-sm text-muted-foreground">Type at least 2 characters</p>
                  ) : isSearchLoading ? (
                    <p className="px-3 py-5 text-center text-sm text-muted-foreground">Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="px-3 py-5 text-center text-sm text-muted-foreground">No matches found</p>
                  ) : (
                    searchResults.map((result) => (
                      <button
                        type="button"
                        key={`${result.type}-${result.id}`}
                        onClick={() => {
                          setIsSearchOpen(false)
                          onSearchNavigate(result.actionUrl)
                        }}
                        className="block w-full border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{result.title}</p>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{result.type}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{result.subtitle}</p>
                        {result.meta && <p className="mt-1 text-[11px] text-muted-foreground">{result.meta}</p>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <ThemeSwitch theme={theme} onToggle={toggleTheme} className="hover:bg-muted" />

          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-foreground transition-opacity hover:opacity-80 hover:bg-muted"
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
            onClick={(event) => {
              event.stopPropagation()
              setIsNotificationsOpen((previous) => !previous)
              setIsMenuOpen(false)
            }}
          >
            <Bell size={15} />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />}
          </button>

          {isNotificationsOpen && (
            <div
              className="absolute right-20 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Notifications</p>
                  <p className="text-[11px] text-muted-foreground">{unreadCount} unread</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void markAllAsRead()
                  }}
                  className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Mark all read
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {isLoadingNotifications ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading notifications...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet</p>
                ) : (
                  notifications.map((item) => (
                    <button
                      type="button"
                      key={item._id}
                      onClick={() => {
                        if (!item.isRead) {
                          void markOneAsRead(item._id)
                        }
                        setIsNotificationsOpen(false)
                        onNotificationNavigate(item.actionUrl)
                      }}
                      className="block w-full border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm ${item.isRead ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>{item.title}</p>
                        {!item.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-muted"
              aria-label="User menu"
              aria-expanded={isMenuOpen}
              onClick={(event) => {
                event.stopPropagation()
                setIsMenuOpen((prev) => !prev)
                setIsNotificationsOpen(false)
              }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                <span className="text-white text-xs font-semibold">{userInitials}</span>
              </div>
              <span className="text-muted-foreground text-sm hidden sm:block">{userName}</span>
              <ChevronDown size={13} className="hidden text-muted-foreground sm:block" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-2 py-2">
                  <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{activeSection}</p>
                </div>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    onViewProfile()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <User size={14} />
                  View profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    onSignOut()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-300 transition-colors hover:bg-neutral-800 hover:text-red-200"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default CRMHeader
