'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, ThrustArea, GoalWithUpdates, UomType, GoalStatus, GoalUpdate } from '@/lib/types'
import { uomOptions } from '@/lib/constants'
import { AnimatedNumber, LoadingSpinner, animationStyles } from '@/components/ui/animations'
import { getTimeGreeting, formatISTDate } from '@/lib/time'

const currentYear = new Date().getFullYear()

interface GoalFormData {
  id?: string
  title: string
  description: string
  thrust_area_id: string
  uom_type: UomType
  target_value: string
  target_date: string
  weightage: string
}

const emptyForm: GoalFormData = {
  title: '',
  description: '',
  thrust_area_id: '',
  uom_type: 'timeline',
  target_value: '',
  target_date: '',
  weightage: '10',
}

const DEPARTMENT_META_PREFIX = 'dept_id:'

function decodeSharedGoalDepartmentId(description: string | null) {
  if (!description?.startsWith(DEPARTMENT_META_PREFIX)) return null
  return description.slice(DEPARTMENT_META_PREFIX.length).split('\n', 1)[0] || null
}

function decodeSharedGoalDescription(description: string | null) {
  if (!description?.startsWith(DEPARTMENT_META_PREFIX)) return description || ''
  return description.split('\n').slice(1).join('\n')
}

function getSaveValidationError(form: GoalFormData) {
  if (!form.title.trim()) return 'Please fill required field: Goal Name.'
  if (!form.thrust_area_id) return 'Please fill required field: Thrust Area.'
  if (!form.uom_type) return 'Please fill required field: UoM Type.'

  const weightage = Number(form.weightage)
  if (!form.weightage.trim() || Number.isNaN(weightage)) {
    return 'Please enter a valid Weightage.'
  }

  if (weightage <= 0 || weightage > 100) {
    return 'Weightage must be between 1 and 100.'
  }

  if (form.uom_type === 'timeline') {
    if (!form.target_date) return 'Please fill required field: Timeline / Deadline.'
    return null
  }

  if (!form.target_value.trim()) return 'Please fill required field: Target Value.'
  const targetValue = Number(form.target_value)
  if (Number.isNaN(targetValue)) return 'Please enter a valid numeric Target Value.'

  return null
}

function getFriendlySaveError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Failed to save'

  if (/null value in column|not-null|required/i.test(message)) {
    return 'Please fill all required fields before saving.'
  }

  if (/invalid input syntax|numeric|double precision|integer/i.test(message)) {
    return 'Please enter valid numeric values for Target Value and Weightage.'
  }

  if (/row-level security|permission denied/i.test(message)) {
    return 'You do not have permission to save this goal.'
  }

  return message
}

function AnimatedInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  options,
  rows = 2
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  rows?: number
}) {
  if (options) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm text-white/70">{label} {required && <span className="text-rose-400">*</span>}</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
        >
          <option value="" className="bg-slate-800">Select...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  if (rows > 1) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm text-white/70">{label} {required && <span className="text-rose-400">*</span>}</label>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all resize-none"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm text-white/70">{label} {required && <span className="text-rose-400">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
      />
    </div>
  )
}

function GoalCard({
  goal,
  thrustAreaName,
  sharedBadge,
  onEdit,
  onDelete,
}: {
  goal: GoalWithUpdates
  thrustAreaName: string
  sharedBadge?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm truncate">{goal.title}</h4>
          <p className="text-white/50 text-xs mt-1">{thrustAreaName}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-white/60 text-xs bg-white/10 px-2 py-1 rounded">{goal.weightage}%</span>
            {sharedBadge || goal.is_shared ? <span className="text-cyan-300 text-xs bg-cyan-500/10 px-2 py-1 rounded">Shared</span> : null}
            {goal.locked && <span className="text-yellow-400 text-xs">🔒</span>}
          </div>
        </div>
        {goal.status === 'draft' && !goal.locked && (
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit?.()} className="p-1 rounded bg-white/10 hover:bg-violet-500/30 text-white/70">✏️</button>
            <button onClick={() => onDelete?.()} className="p-1 rounded bg-white/10 hover:bg-rose-500/30 text-white/70">🗑️</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EmployeeGoalsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<GoalWithUpdates[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [goalUpdates, setGoalUpdates] = useState<GoalUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<GoalFormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const myGoals = useMemo(() => goals.filter(g => g.employee_id === profile?.id), [goals, profile])
  const sharedGoals = useMemo(() => myGoals.filter(g => g.is_shared), [myGoals])
  const departmentSharedTemplates = useMemo(() => {
    if (!profile?.department_id) return []
    return goals.filter(g =>
      g.is_shared &&
      g.primary_goal_id === null &&
      decodeSharedGoalDepartmentId(g.description) === profile.department_id
    )
  }, [goals, profile?.department_id])
  const draftGoals = useMemo(() => myGoals.filter(g => g.status === 'draft'), [myGoals])
  const submittedGoals = useMemo(() => myGoals.filter(g => g.status === 'submitted'), [myGoals])
  const approvedGoals = useMemo(() => myGoals.filter(g => g.status === 'approved'), [myGoals])
  const completedCount = useMemo(() => goalUpdates.filter(u => u.status === 'completed').length, [goalUpdates])
  const weightageTotal = useMemo(() => draftGoals.reduce((sum, g) => sum + Number(g.weightage), 0), [draftGoals])
  const canSubmitDraftGoals = useMemo(
    () => draftGoals.length > 0 && Math.abs(weightageTotal - 100) < 0.0001,
    [draftGoals.length, weightageTotal]
  )

  const thrustAreaMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t.name])), [thrustAreas])
  const isTimelineUom = form.uom_type === 'timeline'
  const valueLabel = isTimelineUom ? 'Timeline / Deadline' : 'Target Value'

  const fetchData = useCallback(async () => {
    if (!profile) return
    const currentYear = new Date().getFullYear()

    const [goalsRes, thrustRes, updatesRes] = await Promise.all([
      supabase.from('goals').select('*').eq('cycle_year', currentYear).order('created_at', { ascending: false }),
      supabase.from('thrust_areas').select('*').order('name'),
      supabase.from('goal_updates').select('*'),
    ])

    const goalsData = (goalsRes.data || []) as Goal[]
    const thrustData = (thrustRes.data || []) as ThrustArea[]
    const updatesData = (updatesRes.data || []) as GoalUpdate[]

    const goalsWithDetails: GoalWithUpdates[] = goalsData.map(g => ({ ...g, thrust_area: thrustData.find(t => t.id === g.thrust_area_id) }))

    setGoals(goalsWithDetails)
    setThrustAreas(thrustData)
    setGoalUpdates(updatesData)
    setLoading(false)
  }, [supabase, profile])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (!profile) return
    setError('')
    setSaving(true)

    try {
      const validationError = getSaveValidationError(form)
      if (validationError) {
        throw new Error(validationError)
      }

      const goalData = {
        employee_id: profile.id,
        thrust_area_id: form.thrust_area_id,
        title: form.title.trim(),
        description: form.description || null,
        uom_type: form.uom_type,
        target_value: form.target_value ? Number(form.target_value) : null,
        target_date: form.target_date || null,
        weightage: Number(form.weightage),
        status: 'draft' as GoalStatus,
        cycle_year: new Date().getFullYear(),
        locked: false,
        is_shared: false,
      }

      if (editingId) {
        const { error: updateError } = await supabase.from('goals').update(goalData).eq('id', editingId)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('goals').insert(goalData)
        if (insertError) throw insertError
      }

      setForm(emptyForm)
      setEditingId(null)
      setShowForm(false)
      setSuccess('Goal saved!')
      await fetchData()
    } catch (err: unknown) {
      setError(getFriendlySaveError(err))
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const handleEdit = (goal: GoalWithUpdates) => {
    if (goal.locked || goal.status !== 'draft') return
    setEditingId(goal.id)
    setForm({
      title: goal.title,
      description: goal.description || '',
      thrust_area_id: goal.thrust_area_id,
      uom_type: goal.uom_type,
      target_value: goal.target_value?.toString() || '',
      target_date: goal.target_date || '',
      weightage: goal.weightage.toString(),
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return
    setError('')
    setSuccess('')

    try {
      const { error: deleteError } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('employee_id', profile?.id ?? '')
        .eq('status', 'draft')

      if (deleteError) throw deleteError

      setSuccess('Goal deleted')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal')
    }
  }

  const handleSubmitDraftGoals = async () => {
    if (!profile) return

    setError('')
    setSuccess('')

    if (draftGoals.length === 0) {
      setError('No draft goals available to submit.')
      return
    }

    if (!canSubmitDraftGoals) {
      setError('Draft submission is allowed only when total draft weightage is exactly 100%.')
      return
    }

    setSaving(true)
    try {
      const submittedCount = draftGoals.length
      const { error: submitError } = await supabase
        .from('goals')
        .update({ status: 'submitted' as GoalStatus })
        .eq('employee_id', profile.id)
        .eq('cycle_year', currentYear)
        .eq('status', 'draft')

      if (submitError) throw submitError

      if (profile.manager_id) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: profile.manager_id,
          type: 'goal_submitted',
          payload: {
            message: `${profile.first_name} ${profile.last_name} submitted ${submittedCount} goal${submittedCount === 1 ? '' : 's'} for approval.`,
            employee_id: profile.id,
            cycle_year: currentYear,
            submitted_count: submittedCount,
          },
        })

        if (notificationError) throw notificationError
      }

      setSuccess('Draft goals submitted successfully!')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit draft goals')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <RoleLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      </RoleLayout>
    )
  }

  const thrustAreaOptions = thrustAreas.map(t => ({ value: t.id, label: t.name }))

  return (
    <RoleLayout>
      <style>{animationStyles}</style>
      <div className="min-h-screen px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">{getTimeGreeting()}, {profile?.first_name}</h1>
          <p className="text-white/60">Track and manage your career goals</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/70">Total Goals</p>
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">🎯</div>
            </div>
            <p className="text-3xl font-bold text-white"><AnimatedNumber value={myGoals.length} /></p>
            <p className="text-xs text-white/50 mt-2">{draftGoals.length} draft</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/70">Submitted</p>
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">📋</div>
            </div>
            <p className="text-3xl font-bold text-white"><AnimatedNumber value={submittedGoals.length} /></p>
            <p className="text-xs text-white/50 mt-2">Pending approval</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/70">Approved</p>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">✅</div>
            </div>
            <p className="text-3xl font-bold text-white"><AnimatedNumber value={approvedGoals.length} /></p>
            <p className="text-xs text-white/50 mt-2">Active</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/70">Completed</p>
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">🔥</div>
            </div>
            <p className="text-3xl font-bold text-white"><AnimatedNumber value={completedCount} /></p>
            <p className="text-xs text-white/50 mt-2">This year</p>
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="space-y-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 flex flex-col">
            <h3 className="text-white font-semibold mb-4">Quick Action</h3>
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true) }} className="w-full py-3 rounded-lg bg-linear-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:shadow-lg transition-all">
              + Add new goal
            </button>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-white font-semibold">Draft Weightage</h3>
              <button
                onClick={handleSubmitDraftGoals}
                disabled={saving || !canSubmitDraftGoals}
                className="px-4 py-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
            <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-white">{weightageTotal}%</span><span className="text-white/60 text-sm">/ 100%</span></div>
            <div className="mt-3 w-full h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${Math.min(weightageTotal, 100)}%` }} /></div>
            {!canSubmitDraftGoals && (
              <p className="text-xs text-amber-300/80 mt-2">
                Submission is enabled only when draft weightage totals exactly 100%.
              </p>
            )}
          </div>

        </div>

        {/* Goal Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">✏️ Draft Goals ({draftGoals.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {draftGoals.length === 0 ? <p className="text-white/40 text-sm text-center py-4">No draft goals</p> : draftGoals.map(goal => <GoalCard key={goal.id} goal={goal} thrustAreaName={thrustAreaMap.get(goal.thrust_area_id) || ''} sharedBadge={goal.is_shared} onEdit={() => handleEdit(goal)} onDelete={() => handleDelete(goal.id)} />)}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">📋 Submitted ({submittedGoals.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {submittedGoals.length === 0 ? <p className="text-white/40 text-sm text-center py-4">No submitted</p> : submittedGoals.map(goal => <GoalCard key={goal.id} goal={goal} thrustAreaName={thrustAreaMap.get(goal.thrust_area_id) || ''} sharedBadge={goal.is_shared} />)}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">✅ Approved ({approvedGoals.length})</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {approvedGoals.length === 0 ? <p className="text-white/40 text-sm text-center py-4">No approved</p> : approvedGoals.map(goal => <GoalCard key={goal.id} goal={goal} thrustAreaName={thrustAreaMap.get(goal.thrust_area_id) || ''} sharedBadge={goal.is_shared} />)}
            </div>
          </div>
        </div>

        {/* Shared Goals */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 min-h-[320px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold">Shared KPIs</h3>
              <p className="text-white/50 text-sm mt-1">Department goals pushed by admins and visible to you</p>
            </div>
            <span className="text-xs text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded">
              {sharedGoals.length} active
            </span>
          </div>

          <div className="flex-1">
            {departmentSharedTemplates.length === 0 ? (
              <p className="text-white/40 text-sm">No shared KPIs available for your department yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {departmentSharedTemplates.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    thrustAreaName={thrustAreaMap.get(goal.thrust_area_id) || ''}
                    sharedBadge
                  />
                ))}
              </div>
            )}
            {departmentSharedTemplates.some(goal => decodeSharedGoalDescription(goal.description)) ? (
              <div className="mt-4 space-y-2">
                {departmentSharedTemplates.map(goal => {
                  const description = decodeSharedGoalDescription(goal.description)
                  return description ? (
                    <p key={goal.id} className="text-xs text-white/45">
                      {goal.title}: {description}
                    </p>
                  ) : null
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-black/80 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">{editingId ? 'Edit Goal' : 'Create New Goal'}</h2>

              {error && <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-300 text-sm">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/70">Goal Name</label>
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Your goal name" className="w-full mt-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:border-violet-500/50 outline-none transition-all" />
                </div>

                <div>
                  <label className="text-sm text-white/70">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the goal" className="w-full mt-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 resize-none focus:border-violet-500/50 outline-none" />
                </div>

                <div>
                  <label className="text-sm text-white/70">Thrust Area</label>
                  <select value={form.thrust_area_id} onChange={e => setForm({ ...form, thrust_area_id: e.target.value })} className="w-full mt-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-violet-500/50 outline-none">
                    <option value="">Select...</option>
                    {thrustAreaOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-white/70">Weightage (%)</label>
                  <input type="number" value={form.weightage} onChange={e => setForm({ ...form, weightage: e.target.value })} className="w-full mt-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-violet-500/50 outline-none" />
                </div>

                <div>
                  <label className="text-sm text-white/70">UoM Type</label>
                  <select
                    value={form.uom_type}
                    onChange={e => setForm({
                      ...form,
                      uom_type: e.target.value as UomType,
                      target_value: e.target.value === 'timeline' ? form.target_value : form.target_value,
                      target_date: e.target.value === 'timeline' ? form.target_date : '',
                    })}
                    className="w-full mt-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-violet-500/50 outline-none"
                  >
                    {uomOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-white/70">{valueLabel}</label>
                  {isTimelineUom ? (
                    <input
                      type="date"
                      value={form.target_date}
                      onChange={e => setForm({ ...form, target_date: e.target.value, target_value: '' })}
                      className="w-full mt-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-violet-500/50 outline-none"
                    />
                  ) : (
                    <input
                      type="number"
                      value={form.target_value}
                      onChange={e => setForm({ ...form, target_value: e.target.value, target_date: '' })}
                      className="w-full mt-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-violet-500/50 outline-none"
                    />
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-all font-medium">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-3 rounded-lg bg-linear-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!showForm && error && <div className="fixed bottom-20 right-6 p-4 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-300 text-sm">⚠️ {error}</div>}
        {success && <div className="fixed bottom-6 right-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm">✅ {success}</div>}
      </div>
    </RoleLayout>
  )
}