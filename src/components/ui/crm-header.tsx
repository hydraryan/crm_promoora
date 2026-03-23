import { useEffect, useMemo, useState } from 'react'
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
  Sun,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/utils/teamConstants'

interface CRMHeaderProps {
  isDetailCollapsed: boolean
  onToggleCollapse: () => void
  activeSection: string
  userName: string
  userInitials: string
  role: Role
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
  activeSection,
  userName,
  userInitials,
  onViewProfile,
  onSignOut,
}: CRMHeaderProps) {
  const [now, setNow] = useState<Date>(new Date())
  const [weather, setWeather] = useState<WeatherState | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
    if (!isMenuOpen) return

    const onWindowClick = () => setIsMenuOpen(false)
    window.addEventListener('click', onWindowClick)
    return () => window.removeEventListener('click', onWindowClick)
  }, [isMenuOpen])

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b border-neutral-800 bg-black">
      <div className="relative z-10 flex h-full w-86 shrink-0 items-center gap-2 px-3">
        <img
          src="/logos/promoora-crm-compact.svg"
          alt="Promoora"
          className="h-10 w-auto shrink-0"
        />
        <button
          onClick={onToggleCollapse}
          className="flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors duration-150 hover:bg-neutral-800 hover:text-neutral-200"
          type="button"
          aria-label={isDetailCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu size={15} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end px-5">
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center rounded-xl border border-neutral-500/80 px-3 py-1.5 text-xs text-neutral-100">
            <div className="pr-3 leading-tight">
              <p className="font-medium tracking-[0.06em]">{dateLine}</p>
            </div>
            <div className="h-8 w-px bg-neutral-600" />
            <div className="pl-3 leading-tight">
              {weatherDisplay && weather ? (
                <>
                  <p className="font-medium">{Math.round(weather.temperatureC)}°C</p>
                  <p className="flex items-center gap-1 text-neutral-300">
                    <weatherDisplay.Icon size={12} />
                    <span>{weatherDisplay.label}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">--°C</p>
                  <p className="text-neutral-400">waiting location...</p>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            className="relative flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800"
            aria-label="Notifications"
          >
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-neutral-800"
              aria-label="User menu"
              aria-expanded={isMenuOpen}
              onClick={(event) => {
                event.stopPropagation()
                setIsMenuOpen((prev) => !prev)
              }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                <span className="text-white text-xs font-semibold">{userInitials}</span>
              </div>
              <span className="text-neutral-300 text-sm hidden sm:block">{userName}</span>
              <ChevronDown size={13} className="hidden text-neutral-500 sm:block" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-neutral-800 bg-[#0f0f0f] p-1 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-2 py-2">
                  <p className="truncate text-sm font-medium text-neutral-200">{userName}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.06em] text-neutral-500">{activeSection}</p>
                </div>
                <div className="my-1 h-px bg-neutral-800" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    onViewProfile()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
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
