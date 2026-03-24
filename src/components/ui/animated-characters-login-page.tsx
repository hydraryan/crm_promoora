import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginUser, requestPasswordResetOtp, resetPasswordWithOtp, storeTokens, storeUser } from '@/services/api'

interface PupilProps {
  size?: number
  maxDistance?: number
  pupilColor?: string
  forceLookX?: number
  forceLookY?: number
}

const Pupil = ({
  size = 12,
  maxDistance = 5,
  pupilColor = 'black',
  forceLookX,
  forceLookY,
}: PupilProps) => {
  const [mouseX, setMouseX] = useState<number>(0)
  const [mouseY, setMouseY] = useState<number>(0)
  const pupilRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX)
      setMouseY(e.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 }

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY }
    }

    const pupil = pupilRef.current.getBoundingClientRect()
    const pupilCenterX = pupil.left + pupil.width / 2
    const pupilCenterY = pupil.top + pupil.height / 2

    const deltaX = mouseX - pupilCenterX
    const deltaY = mouseY - pupilCenterY
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)

    const angle = Math.atan2(deltaY, deltaX)
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance

    return { x, y }
  }

  const pupilPosition = calculatePupilPosition()

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  )
}

interface EyeBallProps {
  size?: number
  pupilSize?: number
  maxDistance?: number
  eyeColor?: string
  pupilColor?: string
  isBlinking?: boolean
  forceLookX?: number
  forceLookY?: number
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = 'black',
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState<number>(0)
  const [mouseY, setMouseY] = useState<number>(0)
  const eyeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX)
      setMouseY(e.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 }

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY }
    }

    const eye = eyeRef.current.getBoundingClientRect()
    const eyeCenterX = eye.left + eye.width / 2
    const eyeCenterY = eye.top + eye.height / 2

    const deltaX = mouseX - eyeCenterX
    const deltaY = mouseY - eyeCenterY
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance)

    const angle = Math.atan2(deltaY, deltaX)
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance

    return { x, y }
  }

  const pupilPosition = calculatePupilPosition()

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  )
}

interface LoginPageProps {
  onAuthenticated?: () => void
}

const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 60_000

function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isForgotFlow, setIsForgotFlow] = useState(false)
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotPassword, setForgotPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotInfo, setForgotInfo] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [mouseX, setMouseX] = useState<number>(0)
  const [mouseY, setMouseY] = useState<number>(0)
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false)
  const [isBlackBlinking, setIsBlackBlinking] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false)
  const [isPurplePeeking, setIsPurplePeeking] = useState(false)

  const purpleRef = useRef<HTMLDivElement>(null)
  const blackRef = useRef<HTMLDivElement>(null)
  const yellowRef = useRef<HTMLDivElement>(null)
  const orangeRef = useRef<HTMLDivElement>(null)

  const isLocked = lockUntil !== null && Date.now() < lockUntil

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX)
      setMouseY(e.clientY)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    if (!lockUntil) {
      setRemainingSeconds(0)
      return
    }

    const updateTimer = () => {
      const diff = Math.max(0, lockUntil - Date.now())
      setRemainingSeconds(Math.ceil(diff / 1000))
      if (diff <= 0) {
        setLockUntil(null)
      }
    }

    updateTimer()
    const interval = window.setInterval(updateTimer, 500)
    return () => window.clearInterval(interval)
  }, [lockUntil])

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000

    let timeoutId = 0

    const scheduleBlink = () => {
      timeoutId = window.setTimeout(() => {
        setIsPurpleBlinking(true)
        window.setTimeout(() => {
          setIsPurpleBlinking(false)
          scheduleBlink()
        }, 150)
      }, getRandomBlinkInterval())
    }

    scheduleBlink()
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000

    let timeoutId = 0

    const scheduleBlink = () => {
      timeoutId = window.setTimeout(() => {
        setIsBlackBlinking(true)
        window.setTimeout(() => {
          setIsBlackBlinking(false)
          scheduleBlink()
        }, 150)
      }, getRandomBlinkInterval())
    }

    scheduleBlink()
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true)
      const timer = window.setTimeout(() => {
        setIsLookingAtEachOther(false)
      }, 800)
      return () => window.clearTimeout(timer)
    }

    setIsLookingAtEachOther(false)
  }, [isTyping])

  useEffect(() => {
    if (password.length > 0 && showPassword) {
      let timeoutId = 0

      const schedulePeek = () => {
        timeoutId = window.setTimeout(() => {
          setIsPurplePeeking(true)
          window.setTimeout(() => {
            setIsPurplePeeking(false)
            schedulePeek()
          }, 800)
        }, Math.random() * 3000 + 2000)
      }

      schedulePeek()
      return () => window.clearTimeout(timeoutId)
    }

    setIsPurplePeeking(false)
  }, [password, showPassword])

  const calculatePosition = (ref: RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 }

    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 3

    const deltaX = mouseX - centerX
    const deltaY = mouseY - centerY

    const faceX = Math.max(-15, Math.min(15, deltaX / 20))
    const faceY = Math.max(-10, Math.min(10, deltaY / 30))
    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120))

    return { faceX, faceY, bodySkew }
  }

  const purplePos = calculatePosition(purpleRef)
  const blackPos = calculatePosition(blackRef)
  const yellowPos = calculatePosition(yellowRef)
  const orangePos = calculatePosition(orangeRef)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    console.log('📝 Login form submitted')
    
    if (isLocked) {
      console.log('🔒 Account locked')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      console.log('🔐 Calling loginUser API...')
      // Call API to login
      const response = await loginUser(email, password)
      console.log('✅ Login response received:', response)

      // Store tokens and user info
      storeTokens(response.accessToken, response.refreshToken)
      storeUser(response.user)

      setFailedAttempts(0)
      onAuthenticated?.()
    } catch (err) {
      console.error('❌ Login error:', err)
      const attempts = failedAttempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS
        setLockUntil(until)
        setFailedAttempts(0)
        setError('Too many attempts. Access locked for 60 seconds.')
      } else {
        setFailedAttempts(attempts)
        const errMessage = err instanceof Error ? err.message : 'Invalid email or password'
        setError(`${errMessage}. Attempts left: ${MAX_ATTEMPTS - attempts}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) {
      setForgotError('Email is required')
      return
    }

    setForgotLoading(true)
    setForgotError('')
    setForgotInfo('')
    try {
      const response = await requestPasswordResetOtp(forgotEmail.trim())
      setForgotInfo(response.message ?? 'OTP sent to your email. Valid for 5 minutes.')
      setForgotStep('verify')
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()

    if (!/^\d{6}$/.test(forgotOtp.trim())) {
      setForgotError('OTP must be 6 digits')
      return
    }

    if (forgotPassword.length < 8) {
      setForgotError('New password must be at least 8 characters')
      return
    }

    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match')
      return
    }

    setForgotLoading(true)
    setForgotError('')
    setForgotInfo('')
    try {
      const response = await resetPasswordWithOtp(forgotEmail.trim(), forgotOtp.trim(), forgotPassword)
      setForgotInfo(response.message ?? 'Password reset successful. Please login with your new password.')
      setIsForgotFlow(false)
      setForgotStep('request')
      setForgotOtp('')
      setForgotPassword('')
      setForgotConfirmPassword('')
      setPassword('')
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between bg-linear-to-br from-primary/90 via-primary to-primary/80 p-12 text-primary-foreground">
        <img
          src="https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1600&q=80"
          alt="Modern office workspace"
          className="absolute inset-0 h-full w-full object-cover opacity-15"
        />
        <div className="relative z-20">
          <div className="flex items-center">
            <div className="flex h-12 w-64 items-center justify-center">
              <img
                src="/logos/promoora-crm-compact.svg"
                alt="Promoora"
                className="h-10 w-auto object-contain object-center"
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-end justify-center h-125">
          <div className="relative" style={{ width: '550px', height: '400px' }}>
            <div
              ref={purpleRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '70px',
                width: '180px',
                height: isTyping || (password.length > 0 && !showPassword) ? '440px' : '400px',
                backgroundColor: '#6C3FF5',
                borderRadius: '10px 10px 0 0',
                zIndex: 1,
                transform:
                  password.length > 0 && showPassword
                    ? 'skewX(0deg)'
                    : isTyping || (password.length > 0 && !showPassword)
                      ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                      : `skewX(${purplePos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && showPassword
                      ? `${20}px`
                      : isLookingAtEachOther
                        ? `${55}px`
                        : `${45 + purplePos.faceX}px`,
                  top:
                    password.length > 0 && showPassword
                      ? `${35}px`
                      : isLookingAtEachOther
                        ? `${65}px`
                        : `${40 + purplePos.faceY}px`,
                }}
              >
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={
                    password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined
                  }
                  forceLookY={
                    password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined
                  }
                />
                <EyeBall
                  size={18}
                  pupilSize={7}
                  maxDistance={5}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isPurpleBlinking}
                  forceLookX={
                    password.length > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined
                  }
                  forceLookY={
                    password.length > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined
                  }
                />
              </div>
            </div>

            <div
              ref={blackRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '240px',
                width: '120px',
                height: '310px',
                backgroundColor: '#2D2D2D',
                borderRadius: '8px 8px 0 0',
                zIndex: 2,
                transform:
                  password.length > 0 && showPassword
                    ? 'skewX(0deg)'
                    : isLookingAtEachOther
                      ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                      : isTyping || (password.length > 0 && !showPassword)
                        ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                        : `skewX(${blackPos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left:
                    password.length > 0 && showPassword
                      ? `${10}px`
                      : isLookingAtEachOther
                        ? `${32}px`
                        : `${26 + blackPos.faceX}px`,
                  top:
                    password.length > 0 && showPassword
                      ? `${28}px`
                      : isLookingAtEachOther
                        ? `${12}px`
                        : `${32 + blackPos.faceY}px`,
                }}
              >
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
                <EyeBall
                  size={16}
                  pupilSize={6}
                  maxDistance={4}
                  eyeColor="white"
                  pupilColor="#2D2D2D"
                  isBlinking={isBlackBlinking}
                  forceLookX={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
              </div>
            </div>

            <div
              ref={orangeRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '0px',
                width: '240px',
                height: '200px',
                zIndex: 3,
                backgroundColor: '#FF9B6B',
                borderRadius: '120px 120px 0 0',
                transform:
                  password.length > 0 && showPassword
                    ? 'skewX(0deg)'
                    : `skewX(${orangePos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? `${50}px` : `${82 + (orangePos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? `${85}px` : `${90 + (orangePos.faceY || 0)}px`,
                }}
              >
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={password.length > 0 && showPassword ? -5 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : undefined}
                />
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={password.length > 0 && showPassword ? -5 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : undefined}
                />
              </div>
            </div>

            <div
              ref={yellowRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '310px',
                width: '140px',
                height: '230px',
                backgroundColor: '#E8D754',
                borderRadius: '70px 70px 0 0',
                zIndex: 4,
                transform:
                  password.length > 0 && showPassword
                    ? 'skewX(0deg)'
                    : `skewX(${yellowPos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              <div
                className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? `${20}px` : `${52 + (yellowPos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? `${35}px` : `${40 + (yellowPos.faceY || 0)}px`,
                }}
              >
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={password.length > 0 && showPassword ? -5 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : undefined}
                />
                <Pupil
                  size={12}
                  maxDistance={5}
                  pupilColor="#2D2D2D"
                  forceLookX={password.length > 0 && showPassword ? -5 : undefined}
                  forceLookY={password.length > 0 && showPassword ? -4 : undefined}
                />
              </div>
              <div
                className="absolute w-20 h-1 bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
                style={{
                  left: password.length > 0 && showPassword ? `${10}px` : `${40 + (yellowPos.faceX || 0)}px`,
                  top: password.length > 0 && showPassword ? `${88}px` : `${88 + (yellowPos.faceY || 0)}px`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-primary-foreground/85">
          <a href="#" className="hover:text-primary-foreground transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-primary-foreground transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-primary-foreground transition-colors">
            Contact
          </a>
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-size-[20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-105">
          <div className="lg:hidden flex items-center justify-center mb-12">
            <div className="flex h-12 w-64 items-center justify-center">
              <img
                src="/logos/promoora-crm-compact.svg"
                alt="Promoora"
                className="h-10 w-auto object-contain object-center"
              />
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Protected access only</p>
          </div>

          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>Three failed attempts trigger a 60 second lockout.</span>
          </div>

          {!isForgotFlow ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ceo@promoora.in"
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                  className="h-12 bg-background border-border/60 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pr-10 bg-background border-border/60 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Remember for 30 days
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline font-medium"
                  onClick={() => {
                    setIsForgotFlow(true)
                    setForgotStep('request')
                    setForgotEmail(email)
                    setForgotError('')
                    setForgotInfo('')
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
                  {error}
                </div>
              )}

              {isLocked && (
                <div className="p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg dark:text-amber-300 dark:bg-amber-950/20 dark:border-amber-900/40">
                  Locked. Try again in {remainingSeconds} second{remainingSeconds === 1 ? '' : 's'}.
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-base font-medium" size="lg" disabled={isLoading || isLocked}>
                {isLoading ? 'Verifying...' : isLocked ? 'Access Locked' : 'Log in'}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Reset password using OTP</p>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => {
                    setIsForgotFlow(false)
                    setForgotError('')
                    setForgotInfo('')
                  }}
                >
                  Back to login
                </button>
              </div>

              {forgotStep === 'request' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-sm font-medium">
                      Registered email
                    </Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="member@promoora.in"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      className="h-12 bg-background border-border/60 focus:border-primary"
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-medium" size="lg" disabled={forgotLoading}>
                    {forgotLoading ? 'Sending OTP...' : 'Send 6-digit OTP'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-otp" className="text-sm font-medium">
                      6-digit OTP
                    </Label>
                    <Input
                      id="forgot-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      className="h-12 bg-background border-border/60 focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="forgot-new-password" className="text-sm font-medium">
                      New password
                    </Label>
                    <Input
                      id="forgot-new-password"
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={forgotPassword}
                      onChange={(e) => setForgotPassword(e.target.value)}
                      required
                      className="h-12 bg-background border-border/60 focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="forgot-confirm-password" className="text-sm font-medium">
                      Confirm new password
                    </Label>
                    <Input
                      id="forgot-confirm-password"
                      type="password"
                      placeholder="Re-enter new password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      required
                      className="h-12 bg-background border-border/60 focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => setForgotStep('request')}
                    >
                      Resend OTP
                    </button>
                    <p className="text-xs text-muted-foreground">OTP valid for 5 minutes</p>
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-medium" size="lg" disabled={forgotLoading}>
                    {forgotLoading ? 'Resetting...' : 'Reset password'}
                  </Button>
                </form>
              )}

              {forgotInfo && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-100 p-3 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {forgotInfo}
                </div>
              )}
              {forgotError && (
                <div className="rounded-lg border border-red-300 bg-red-100 p-3 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
                  {forgotError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const Component = LoginPage
