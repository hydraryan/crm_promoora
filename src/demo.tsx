import { Component } from '@/components/ui/animated-characters-login-page'

interface DemoOneProps {
  onAuthenticated?: () => void
}

export default function DemoOne({ onAuthenticated }: DemoOneProps) {
  return <Component onAuthenticated={onAuthenticated} />
}
