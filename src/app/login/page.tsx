'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && profile) {
      router.replace('/dashboard')
    }
  }, [loading, profile, router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await signIn(email, password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.replace('/dashboard')
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c1833] via-[#13274d] to-[#081225] px-4 py-10 text-white">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#111f3e]/80 p-8 shadow-2xl backdrop-blur">
        <h1 className="mb-2 text-3xl font-semibold">AtomQuest Portal</h1>
        <p className="mb-8 text-sm text-slate-300">Sign in to continue</p>

        <form onSubmit={onSubmit} className="space-y-5">
          {error ? <p className="rounded-lg bg-red-500/20 p-3 text-sm text-red-200">{error}</p> : null}

          <label className="block text-sm">
            <span className="mb-2 block text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2 outline-none ring-blue-400 transition focus:ring"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2 outline-none ring-blue-400 transition focus:ring"
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium transition hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-300">
          No account?{' '}
          <Link href="/register" className="font-medium text-blue-300 hover:text-blue-200">
            Register here
          </Link>
        </p>
      </section>
    </main>
  )
}
