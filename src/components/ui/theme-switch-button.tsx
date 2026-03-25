import { Moon, Sun } from 'lucide-react'

interface ThemeSwitchProps {
  className?: string
  theme: 'light' | 'dark'
  onToggle: () => void
}

export function ThemeSwitch({ className = '', theme, onToggle }: ThemeSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-foreground transition-opacity hover:opacity-80 ${className}`}
    >
      <Sun
        className={`absolute h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'light' ? 'scale-100 translate-y-0 opacity-100' : 'scale-50 translate-y-5 opacity-0'
        }`}
      />
      <Moon
        className={`absolute h-5 w-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'dark' ? 'scale-100 translate-y-0 opacity-100' : 'scale-50 translate-y-5 opacity-0'
        }`}
      />
    </button>
  )
}
