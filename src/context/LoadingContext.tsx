import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface LoadingContextValue {
  isLoading: boolean
  activeRequests: number
}

const LoadingContext = createContext<LoadingContextValue>({
  isLoading: false,
  activeRequests: 0,
})

let activeRequests = 0
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

export function beginGlobalLoading() {
  activeRequests += 1
  notify()
}

export function endGlobalLoading() {
  activeRequests = Math.max(0, activeRequests - 1)
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return {
    isLoading: activeRequests > 0,
    activeRequests,
  }
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(getSnapshot)

  useEffect(() => {
    return subscribe(() => {
      setState(getSnapshot())
    })
  }, [])

  const value = useMemo<LoadingContextValue>(
    () => ({
      isLoading: state.isLoading,
      activeRequests: state.activeRequests,
    }),
    [state.activeRequests, state.isLoading]
  )

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
}

export function useLoading() {
  return useContext(LoadingContext)
}
