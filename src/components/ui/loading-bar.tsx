import { useEffect, useState } from 'react'
import { useLoading } from '@/context/LoadingContext'

export function GlobalLoadingBar() {
  const { isLoading } = useLoading()
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      if (!isVisible) return
      setProgress(100)
      const hideTimer = window.setTimeout(() => {
        setIsVisible(false)
        setProgress(0)
      }, 220)
      return () => window.clearTimeout(hideTimer)
    }

    setIsVisible(true)
    setProgress(12)

    const interval = window.setInterval(() => {
      setProgress((previous) => {
        if (previous >= 85) return previous
        const delta = previous < 45 ? 10 : previous < 70 ? 6 : 3
        return Math.min(85, previous + delta)
      })
    }, 180)

    return () => window.clearInterval(interval)
  }, [isLoading, isVisible])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed top-0 left-0 right-0 z-[70] h-0.75 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="h-full bg-[#22c55e] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
