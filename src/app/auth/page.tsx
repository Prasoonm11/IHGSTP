'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  Lock,
  Mail,
  Shield,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Department } from '@/lib/types'

type AuthMode = 'login' | 'register'

type FormData = {
  email: string
  password: string
  first_name: string
  last_name: string
  department_id: string
  role: 'employee' | 'manager' | 'admin' | ''
  manager_id: string
}

const initialFormData: FormData = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  department_id: '',
  role: '',
  manager_id: '',
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getLoginValidationError(formData: FormData) {
  if (!formData.email.trim()) return 'Please enter your email address.'
  if (!isValidEmail(formData.email.trim())) return 'Please enter a valid email address.'
  if (!formData.password.trim()) return 'Please enter your password.'
  return null
}

function getRegisterValidationError(formData: FormData) {
  if (!formData.first_name.trim()) return 'Please fill required field: First name.'
  if (!formData.last_name.trim()) return 'Please fill required field: Last name.'
  if (!formData.role) return 'Please select a role.'
  if (formData.role !== 'admin' && !formData.department_id) return 'Please select a department.'
  if (!formData.email.trim()) return 'Please fill required field: Email.'
  if (!isValidEmail(formData.email.trim())) return 'Please enter a valid email address.'
  if (!formData.password.trim()) return 'Please fill required field: Password.'
  if (formData.password.length < 6) return 'Password must be at least 6 characters.'
  return null
}

function getFriendlyAuthError(error: unknown, mode: AuthMode) {
  const message = error instanceof Error ? error.message : (mode === 'login' ? 'Failed to sign in' : 'Failed to create account')

  if (/invalid login credentials/i.test(message)) return 'Invalid email or password.'
  if (/email not confirmed/i.test(message)) return 'Please verify your email first, then sign in.'
  if (/user already registered/i.test(message)) return 'This email is already registered. Please sign in instead.'
  if (/password should be at least/i.test(message)) return 'Password is too weak. Use at least 6 characters.'
  if (/invalid email/i.test(message)) return 'Please enter a valid email address.'
  if (/null value in column|not-null|required/i.test(message)) return 'Please fill all required fields.'
  if (/row-level security|permission denied/i.test(message)) return 'You do not have permission to perform this action.'

  return message
}

const featureCards = [
  {
    icon: BarChart3,
    title: 'Live goal intelligence',
    description: 'Track targets, check-ins, and momentum in one cinematic workspace.',
  },
  {
    icon: Layers3,
    title: 'Fluid team alignment',
    description: 'Move between employee, manager, and admin workflows without friction.',
  },
  {
    icon: Shield,
    title: 'Secure by design',
    description: 'Frosted glass surfaces and trusted auth flows with clean access control.',
  },
]

function BackgroundGlow() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(167,139,250,0.20), transparent 36%), radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent 28%), radial-gradient(circle at bottom, rgba(236,72,153,0.14), transparent 34%)',
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[72px_72px] opacity-25 mask-[radial-gradient(circle_at_center,black,transparent_78%)]" />
      <motion.div
        aria-hidden
        className="absolute -left-16 -top-16 rounded-full bg-violet-500/20 blur-[120px]"
        style={{ width: '28rem', height: '28rem' }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-16 -right-16 h-104 w-104 rounded-full bg-fuchsia-500/15 blur-[120px]"
        animate={{ x: [0, -18, 0], y: [0, -14, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  )
}

function FieldShell({
  label,
  icon: Icon,
  children,
  hint,
}: {
  label: string
  icon: typeof Mail
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-white/55">
          {label}
        </label>
        {hint ? <span className="text-xs text-white/35">{hint}</span> : null}
      </div>
      <div className="group relative">
        <div className="absolute inset-0 rounded-2xl bg-linear-to-r from-violet-500/20 via-fuchsia-500/20 to-cyan-500/20 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100" />
        <div className="relative flex items-center rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5 backdrop-blur-xl transition-all duration-300 group-focus-within:border-white/18 group-focus-within:bg-white/9 group-focus-within:shadow-[0_0_0_1px_rgba(168,85,247,0.20),0_16px_50px_rgba(0,0,0,0.25)]">
          <Icon className="mr-3 h-4.5 w-4.5 shrink-0 text-white/35 transition-colors duration-300 group-focus-within:text-violet-300" />
          {children}
        </div>
      </div>
    </div>
  )
}

function AuthInput({
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  className,
}: {
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete?: string
  className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={`w-full bg-transparent text-sm text-white placeholder:text-white/32 outline-none ${className || ''}`}
    />
  )
}

function AuthSelect({
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  required?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className="w-full appearance-none bg-transparent text-sm text-white outline-none"
    >
      <option value="" className="bg-slate-950 text-white">
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-slate-950 text-white">
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default function AuthPage() {
  const router = useRouter()
  const { signIn, profile, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [mode, setMode] = useState<AuthMode>('login')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [oauthSubmitting, setOauthSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  useEffect(() => {
    if (!authLoading && profile) {
      router.replace('/dashboard')
    }
  }, [authLoading, profile, router])

  useEffect(() => {
    const fetchReferenceData = async () => {
      const [departmentResult, managerResult] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('profiles').select('id, first_name, last_name').in('role', ['manager', 'admin']).order('first_name'),
      ])

      setDepartments((departmentResult.data || []) as Department[])
      setManagers(
        (managerResult.data || []).map((manager) => ({
          id: manager.id,
          name: `${manager.first_name} ${manager.last_name}`.trim(),
        }))
      )
    }

    fetchReferenceData()
  }, [supabase])

  const resetFeedback = () => {
    setError('')
    setSuccess('')
  }

  const switchMode = () => {
    resetFeedback()
    setShowPassword(false)
    setFormData((current) => ({
      ...initialFormData,
      email: current.email,
    }))
    setMode((current) => (current === 'login' ? 'register' : 'login'))
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    resetFeedback()
    setSubmitting(true)

    const validationError = getLoginValidationError(formData)
    if (validationError) {
      setError(validationError)
      setSubmitting(false)
      return
    }

    const result = await signIn(formData.email.trim().toLowerCase(), formData.password)
    setSubmitting(false)

    if (result.error) {
      setError(getFriendlyAuthError(new Error(result.error), 'login'))
      return
    }

    router.replace('/dashboard')
  }

  const handleMicrosoftLogin = async () => {
    resetFeedback()
    router.push('/microsoft')
  }

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    resetFeedback()
    setSubmitting(true)

    try {
      const validationError = getRegisterValidationError(formData)
      if (validationError) {
        setError(validationError)
        setSubmitting(false)
        return
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create account')

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: formData.email.trim().toLowerCase(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        role: formData.role,
        department_id: formData.department_id || null,
        manager_id: formData.manager_id || null,
      })

      if (profileError) throw profileError

      setSuccess('Account created. Please check your email to verify your account.')
      setTimeout(() => {
        setMode('login')
        setShowPassword(false)
        setFormData((current) => ({
          ...initialFormData,
          email: current.email,
        }))
      }, 1800)
    } catch (registerError: unknown) {
      setError(getFriendlyAuthError(registerError, 'register'))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault()
    resetFeedback()
    setSubmitting(true)

    try {
      if (!resetEmail) {
        setError('Please enter your email address')
        setSubmitting(false)
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      setSuccess('Password reset link sent! Check your email to continue.')
      setResetEmail('')
      setTimeout(() => {
        setIsResetMode(false)
        resetFeedback()
      }, 2500)
    } catch (resetError: unknown) {
      setError(resetError instanceof Error ? resetError.message : 'Failed to send reset email')
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === 'login'
  const deptOptions = departments.map((department) => ({ value: department.id, label: department.name }))
  const managerOptions = managers.map((manager) => ({ value: manager.id, label: manager.name }))

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080615] text-white">
      <BackgroundGlow />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="w-full">
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 90, damping: 20, mass: 0.85 }}
            className="relative mx-auto grid min-h-200 overflow-hidden rounded-4xl border border-white/10 bg-white/5 shadow-[0_40px_140px_rgba(0,0,0,0.55)] lg:h-200 lg:min-h-200 lg:grid-cols-2"
          >
            {/* Left Section - Decorative Purple Panel */}
            <motion.section
              layout
              transition={{ type: 'spring', stiffness: 90, damping: 18, mass: 0.9 }}
              className="relative isolate min-h-65 overflow-hidden border-b border-white/8 p-8 lg:min-h-185 lg:border-b-0 lg:border-r"
              style={{
                background:
                  'radial-gradient(circle at top, rgba(167,139,250,0.26), transparent 38%), linear-gradient(145deg, rgba(12,9,28,0.96), rgba(26,12,49,0.92) 45%, rgba(8,8,18,0.98))',
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_38%)] opacity-70" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(192,132,252,0.12),transparent_24%),radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.08),transparent_18%),radial-gradient(circle_at_70%_85%,rgba(236,72,153,0.10),transparent_20%)]" />

              {/* Decorative Elements */}
              <div className="absolute inset-0 opacity-15">
                <svg className="h-full w-full" viewBox="0 0 400 600" preserveAspectRatio="none">
                  <path d="M50,50 Q150,0 200,100 T400,200" stroke="white" strokeWidth="2" fill="none" />
                  <path d="M80,250 Q200,200 300,350 T400,500" stroke="white" strokeWidth="2" fill="none" />
                  <path d="M0,400 Q100,350 200,450 T400,550" stroke="white" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
              <motion.div
                className="absolute top-12 right-12 opacity-20"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div className="h-4 w-4 rounded-full border-2 border-white" />
              </motion.div>
              <div className="absolute top-40 right-20 opacity-25">
                <div className="flex flex-col gap-1">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="h-1 w-1 rounded-full bg-white" />
                  ))}
                </div>
              </div>
              <motion.div
                className="absolute bottom-20 left-8 opacity-15"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="h-3 w-3 rounded-full border border-white" />
              </motion.div>

              <div className="relative h-full flex flex-col justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                >
                  <h2 className="text-4xl font-bold text-white mb-4">
                    {mode === 'login' ? 'Welcome back!' : 'Create account'}
                  </h2>
                  <p className="text-lg text-white/75 leading-relaxed max-w-sm">
                    {mode === 'login'
                      ? 'You can sign in to access with your existing account.'
                      : 'Get started by creating your new account today.'}
                  </p>
                </motion.div>
              </div>
            </motion.section>

            {/* Right Section - Black Form Panel */}
            <motion.section
              layout
              transition={{ type: 'spring', stiffness: 90, damping: 18, mass: 0.9 }}
              className="relative flex min-h-65 items-center justify-center p-8 lg:min-h-185"
              style={{ background: '#000000' }}
            >
              <AuthPanel
                mode={mode}
                formData={formData}
                setFormData={setFormData}
                departments={deptOptions}
                managers={managerOptions}
                submitting={submitting}
                error={error}
                success={success}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                onSubmit={handleLogin}
                onRegister={handleRegister}
                onModeSwitch={switchMode}
                isResetMode={isResetMode}
                setIsResetMode={setIsResetMode}
                resetEmail={resetEmail}
                setResetEmail={setResetEmail}
                onPasswordReset={handlePasswordReset}
                onMicrosoftLogin={handleMicrosoftLogin}
                oauthSubmitting={oauthSubmitting}
              />
            </motion.section>
          </motion.div>
        </div>
      </div>
    </main>
  )
}

function AuthPanel({
  mode,
  formData,
  setFormData,
  departments,
  managers,
  submitting,
  error,
  success,
  showPassword,
  setShowPassword,
  onSubmit,
  onRegister,
  onModeSwitch,
  isResetMode,
  setIsResetMode,
  resetEmail,
  setResetEmail,
  onPasswordReset,
  onMicrosoftLogin,
  oauthSubmitting,
}: {
  mode: AuthMode
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  departments: { value: string; label: string }[]
  managers: { value: string; label: string }[]
  submitting: boolean
  error: string
  success: string
  showPassword: boolean
  setShowPassword: (value: boolean) => void
  onSubmit: (event: React.FormEvent) => Promise<void>
  onRegister: (event: React.FormEvent) => Promise<void>
  onModeSwitch: () => void
  isResetMode: boolean
  setIsResetMode: (value: boolean) => void
  resetEmail: string
  setResetEmail: (value: string) => void
  onPasswordReset: (event: React.FormEvent) => Promise<void>
  onMicrosoftLogin: () => Promise<void>
  oauthSubmitting: boolean
}) {
  const isLogin = mode === 'login'

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mode}
        initial={{ opacity: 0, x: isLogin ? -28 : 28, scale: 0.985 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: isLogin ? 28 : -28, scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.9 }}
        className="w-full max-w-3xl"
        style={{ willChange: 'transform, opacity' }}
      >
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/favicon.ico"
            alt="AlignHQ Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <h2 className="text-lg font-bold text-white">AlignHQ</h2>
            <p className="text-xs text-white/50">Goal setting and tracking portal</p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.3em] text-violet-200/60">{isResetMode ? 'Account Recovery' : 'Welcome'}</p>
        <motion.h1
          key={isResetMode ? 'reset' : mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl"
        >
          {isResetMode ? 'Reset your password' : (isLogin ? 'Sign in to your workspace' : 'Create your account')}
        </motion.h1>
        <motion.p
          key={isResetMode ? 'reset-subtitle' : `${mode}-subtitle`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, type: 'spring', stiffness: 120, damping: 20 }}
          className="mt-2 max-w-lg text-sm leading-6 text-white/58"
        >
          {isResetMode ? 'Enter your email address and we\'ll send you a link to reset your password.' : ''}
        </motion.p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="mb-5 rounded-2xl border border-rose-500/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100 shadow-[0_18px_45px_rgba(190,18,60,0.18)]"
          >
            {error}
          </motion.div>
        ) : null}
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100 shadow-[0_18px_45px_rgba(16,185,129,0.18)]"
          >
            {success}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isResetMode ? (
        <form onSubmit={onPasswordReset} className="space-y-4">
          <FieldShell label="Email" icon={Mail}>
            <AuthInput
              type="email"
              value={resetEmail}
              onChange={(value) => setResetEmail(value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </FieldShell>

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={{ scale: submitting ? 1 : 1.015 }}
            whileTap={{ scale: submitting ? 1 : 0.99 }}
            className="w-full rounded-xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 font-semibold text-white transition-all hover:shadow-[0_20px_50px_rgba(168,85,247,0.25)] disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Send reset link'
            )}
          </motion.button>

          <div className="flex items-center justify-center pt-2">
            <button
              type="button"
              onClick={() => setIsResetMode(false)}
              className="inline-flex items-center gap-1 font-semibold text-violet-200 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={isLogin ? onSubmit : onRegister} className="space-y-3 sm:space-y-4">
          {isLogin ? (
            <motion.button
              type="button"
              onClick={onMicrosoftLogin}
              disabled={submitting || oauthSubmitting}
              whileHover={{ scale: submitting || oauthSubmitting ? 1 : 1.015 }}
              whileTap={{ scale: submitting || oauthSubmitting ? 1 : 0.99 }}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-sm font-semibold text-white transition-all hover:border-white/18 hover:bg-white/9 hover:shadow-[0_18px_55px_rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-white p-0.5">
                <span className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
                  <span className="bg-[#f35325]" />
                  <span className="bg-[#81bc06]" />
                  <span className="bg-[#05a6f0]" />
                  <span className="bg-[#ffba08]" />
                </span>
              </span>
              {oauthSubmitting ? 'Connecting to Microsoft...' : 'Continue with Microsoft'}
            </motion.button>
          ) : null}

          {isLogin ? (
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/35">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          ) : null}

        <AnimatePresence initial={false} mode="popLayout">
          {!isLogin ? (
            <motion.div
              key="register-fields"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <FieldShell label="First name" icon={User}>
                <AuthInput
                  value={formData.first_name}
                  onChange={(value) => setFormData((current) => ({ ...current, first_name: value }))}
                  placeholder="Prasoon"
                  autoComplete="given-name"
                />
              </FieldShell>
              <FieldShell label="Last name" icon={User}>
                <AuthInput
                  value={formData.last_name}
                  onChange={(value) => setFormData((current) => ({ ...current, last_name: value }))}
                  placeholder="Mathur"
                  autoComplete="family-name"
                />
              </FieldShell>
              <FieldShell label="Role" icon={Users}>
                <AuthSelect
                  value={formData.role}
                  onChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      role: value as FormData['role'],
                      department_id: value === 'admin' ? '' : current.department_id,
                      manager_id: value !== 'employee' ? '' : current.manager_id,
                    }))
                  }
                  options={[
                    { value: 'employee', label: 'Employee' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'admin', label: 'Admin / HR' },
                  ]}
                  placeholder="Choose role"
                  required
                />
              </FieldShell>
              {formData.role !== 'admin' ? (
                <FieldShell label="Department" icon={Building2}>
                  <AuthSelect
                    value={formData.department_id}
                    onChange={(value) => setFormData((current) => ({ ...current, department_id: value }))}
                    options={departments}
                    placeholder="Choose department"
                  />
                </FieldShell>
              ) : null}
              {formData.role === 'employee' ? (
                <FieldShell label="Manager" icon={Users} hint="Optional">
                  <AuthSelect
                    value={formData.manager_id}
                    onChange={(value) => setFormData((current) => ({ ...current, manager_id: value }))}
                    options={managers}
                    placeholder="Choose manager"
                  />
                </FieldShell>
              ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>

        <FieldShell label="Email" icon={Mail}>
          <AuthInput
            type="email"
            value={formData.email}
            onChange={(value) => setFormData((current) => ({ ...current, email: value }))}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </FieldShell>

        <FieldShell label="Password" icon={Lock}>
          <div className="relative flex w-full items-center">
            <AuthInput
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(value) => setFormData((current) => ({ ...current, password: value }))}
              placeholder="Enter your password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/6 p-2 text-white/45 transition-colors hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </FieldShell>

        {isLogin ? (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsResetMode(true)}
              className="text-sm text-violet-200/70 transition-colors hover:text-violet-100"
            >
              Forgot password?
            </button>
          </div>
        ) : null}

        <motion.button
          type="submit"
          disabled={submitting}
          whileHover={{ scale: submitting ? 1 : 1.015 }}
          whileTap={{ scale: submitting ? 1 : 0.99 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="group relative mt-2 inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#d946ef_48%,#22d3ee)] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(139,92,246,0.32)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="relative z-10 flex items-center gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                {isLogin ? 'Signing in' : 'Creating account'}
              </>
            ) : (
              <>
                {isLogin ? 'Sign in' : 'Create account'}
                <ArrowRight className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </>
            )}
          </span>
          <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.32),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </motion.button>
        </form>
      )}

        {!isResetMode ? (
          <div className="mt-8 text-center text-sm text-white/56">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={onModeSwitch}
              className="inline-flex items-center gap-1 font-semibold text-violet-200 transition-colors hover:text-white"
            >
              {isLogin ? 'Create one' : 'Sign in'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  )
}
