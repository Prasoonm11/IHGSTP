'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { roleOptions } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { Department, Profile, Role } from '@/lib/types'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const { signUp } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [departmentId, setDepartmentId] = useState('')
  const [managerId, setManagerId] = useState('')

  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const loadMeta = async () => {
      try {
        // Prefer server-side meta endpoint (uses service role) so unauthenticated users can see departments
        const res = await fetch('/api/meta')
        if (res.ok) {
          const body = await res.json()
          setDepartments((body.departments as Department[]) ?? [])
          setManagers((body.managers as Profile[]) ?? [])
          return
        }

        // fallback to anonymous client queries
        const [deptRes, managerRes] = await Promise.all([
          supabase.from('departments').select('id, name').order('name'),
          supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role, department_id, manager_id')
            .eq('role', 'manager')
            .order('first_name')
        ])

        setDepartments((deptRes.data as Department[] | null) ?? [])
        setManagers((managerRes.data as Profile[] | null) ?? [])
      } catch (err) {
        setDepartments([])
        setManagers([])
      }
    }

    void loadMeta()
  }, [supabase])

  const filteredManagers = useMemo(
    () => managers.filter((m) => !departmentId || m.department_id === departmentId),
    [departmentId, managers]
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await signUp({
      firstName,
      lastName,
      email,
      password,
      role,
      departmentId: departmentId || null,
      managerId: role === 'employee' ? managerId || null : null
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.replace('/login?registered=true')
  }

  const handleBootstrap = async () => {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/bootstrap-departments', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to create sample departments')
      } else {
        // reload departments
        const deptRes = await supabase.from('departments').select('id, name').order('name')
        setDepartments((deptRes.data as Department[] | null) ?? [])
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c1833] via-[#13274d] to-[#081225] px-4 py-10 text-white">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-[#111f3e]/80 p-8 shadow-2xl backdrop-blur">
        <h1 className="mb-2 text-3xl font-semibold">Create Account</h1>
        <p className="mb-8 text-sm text-slate-300">Set up your role for AtomQuest</p>

        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          {error ? <p className="col-span-full rounded-lg bg-red-500/20 p-3 text-sm text-red-200">{error}</p> : null}

          <label className="text-sm">
            <span className="mb-2 block">First Name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2" required />
          </label>

          <label className="text-sm">
            <span className="mb-2 block">Last Name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2" required />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-2 block">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2" required />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="mb-2 block">Password</span>
            <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2" required />
          </label>

          <label className="text-sm">
            <span className="mb-2 block">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2">
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          {role !== 'admin' ? (
            <label className="text-sm">
              <span className="mb-2 block">Department</span>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2">
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {departments.length === 0 ? (
                <div className="mt-2 text-sm text-slate-300">
                  No departments found. You can create sample departments locally.
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={submitting} onClick={handleBootstrap} className="rounded bg-blue-600 px-3 py-1 text-sm">
                      {submitting ? 'Creating...' : 'Create sample departments'}
                    </button>
                    <a target="_blank" rel="noreferrer" href="https://app.supabase.com" className="text-sm text-blue-300 underline">Open Supabase</a>
                  </div>
                </div>
              ) : null}
            </label>
          ) : null}

          {role === 'employee' ? (
            <label className="text-sm md:col-span-2">
              <span className="mb-2 block">Reporting Manager (L1)</span>
              <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="w-full rounded-lg border border-white/20 bg-[#0d1a36] px-3 py-2">
                <option value="">Select Manager</option>
                {filteredManagers.map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <button type="submit" disabled={submitting} className="md:col-span-2 mt-2 w-full rounded-lg bg-blue-600 py-2.5 font-medium transition hover:bg-blue-500 disabled:opacity-50">
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-300">
          Already registered?{' '}
          <Link href="/login" className="font-medium text-blue-300 hover:text-blue-200">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
