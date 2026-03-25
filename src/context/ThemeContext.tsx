import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type ThemeMode = 'dark' | 'light'

interface ThemeContextValue {
  theme: ThemeMode
  isDarkMode: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
      return () => {
        root.classList.remove('light')
      }
    }
    root.classList.remove('light')
    return undefined
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDarkMode: theme === 'dark',
      toggleTheme: () => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark')),
    }),
    [theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
