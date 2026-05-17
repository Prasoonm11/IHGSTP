'use client'

import { useState, useEffect } from 'react'

export function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTime: number | null = null
    const startValue = 0

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.floor(startValue + (value - startValue) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <span>{displayValue}</span>
}

export function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/10 rounded-lg ${className}`} />
  )
}

export function CardGradient({
  children,
  gradient = 'from-slate-700 to-slate-800',
  hover = true,
  className = ''
}: {
  children: React.ReactNode
  gradient?: string
  hover?: boolean
  className?: string
}) {
  return (
    <div
      className={`
          relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-sm bg-linear-to-br ${gradient}
        border border-white/10 shadow-lg
        ${hover ? 'transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:border-white/20' : ''}
        ${className}
      `}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

export function StatCard({
  icon,
  label,
  value,
  gradient = 'from-indigo-500 to-purple-600',
  delay = 0
}: {
  icon: string
  label: string
  value: number
  gradient?: string
  delay?: number
}) {
  return (
    <div
      className={`
          relative overflow-hidden rounded-2xl p-5
          bg-black/40 backdrop-blur-sm bg-linear-to-br ${gradient}
        shadow-lg shadow-purple-500/20
        transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl
        animate-fade-in-up
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
      <div className="relative z-10">
        <p className="text-white/80 text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold text-white mt-1">
          <AnimatedNumber value={value} />
        </p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-white/30 to-transparent" />
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  icon,
  gradient = 'from-indigo-600 via-purple-600 to-pink-500',
  actions
}: {
  title: string
  subtitle?: string
  icon?: string
  gradient?: string
  actions?: React.ReactNode
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-linear-to-r ${gradient} p-6 shadow-2xl mb-6`}>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {icon && (
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-white/80 mt-1">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-24',
    md: 'w-40',
    lg: 'w-56'
  }

  return (
    <div className="flex items-center justify-center">
      <LoadingBar className={sizes[size]} />
    </div>
  )
}

export function LoadingBar({ className = '' }: { className?: string }) {
  return (
    <div className={`h-1.5 w-40 bg-white/10 rounded-full overflow-hidden ${className}`}>
      <div className="h-full w-1/3 bg-linear-to-r from-violet-500 to-fuchsia-500 animate-loading-bar" />
    </div>
  )
}

export function Badge({
  children,
  variant = 'default'
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const variants = {
    default: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    danger: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    info: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function ProgressBar({
  value,
  max = 100,
  gradient = 'from-cyan-500 to-blue-500',
  showLabel = true
}: {
  value: number
  max?: number
  gradient?: string
  showLabel?: boolean
}) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-sm text-white/60 mb-1">
          <span>Progress</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-linear-to-r ${gradient} rounded-full transition-all duration-1000`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function EmptyState({
  icon = '📭',
  title = 'No data found',
  description = 'There are no items to display'
}: {
  icon?: string
  title?: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-4xl mb-4">
          {icon}
      </div>
      <h3 className="text-lg font-semibold text-white/80">{title}</h3>
      <p className="text-white/50 text-sm mt-1">{description}</p>
    </div>
  )
}

export const statusColors: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  draft: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', gradient: 'from-slate-500 to-slate-600' },
  submitted: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', gradient: 'from-amber-500 to-orange-600' },
  approved: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', gradient: 'from-emerald-500 to-teal-600' },
  rework: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', gradient: 'from-rose-500 to-red-600' },
  completed: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', gradient: 'from-violet-500 to-fuchsia-600' },
  not_started: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', gradient: 'from-slate-500 to-slate-600' },
  on_track: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', gradient: 'from-emerald-500 to-teal-600' },
}

export const roleColors: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  employee: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', gradient: 'from-violet-500 to-fuchsia-600' },
  manager: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', gradient: 'from-purple-500 to-pink-600' },
  admin: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', gradient: 'from-rose-500 to-red-600' },
}

export function GradientButton({
  children,
  onClick,
  gradient = 'from-violet-500 to-fuchsia-500',
  icon,
  disabled = false,
  className = ''
}: {
  children: React.ReactNode
  onClick?: () => void
  gradient?: string
  icon?: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative overflow-hidden px-4 py-2.5 rounded-xl
        bg-linear-to-r ${gradient}
        shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${className}
      `}
    >
      <div className="absolute inset-0 bg-linear-to-r from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <span className="text-white font-medium">{children}</span>
      </div>
    </button>
  )
}

// CSS styles to be added to global CSS or used via style tag
export const animationStyles = `
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.5s ease-out forwards;
    opacity: 0;
  }
  @keyframes slide-in-right {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .animate-slide-in-right {
    animation: slide-in-right 0.4s ease-out forwards;
    opacity: 0;
  }
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
    }
    50% {
      box-shadow: 0 0 40px rgba(16, 185, 129, 0.5);
    }
  }
  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
  @keyframes loading-bar {
    0% {
      transform: translateX(-120%);
    }
    100% {
      transform: translateX(340%);
    }
  }
  .animate-loading-bar {
    animation: loading-bar 1s ease-in-out infinite;
  }
`