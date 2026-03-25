import * as React from 'react'
import { ThemeSwitch } from '@/components/ui/theme-switch-button'

export function ThemeSwitchDemo() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark')

  React.useEffect(() => {
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

  return (
    <div className="flex items-center justify-center py-8">
      <ThemeSwitch
        theme={theme}
        onToggle={() => setTheme((previous) => (previous === 'light' ? 'dark' : 'light'))}
      />
    </div>
  )
}
