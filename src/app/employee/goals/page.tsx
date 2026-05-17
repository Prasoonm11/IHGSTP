'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, ThrustArea, GoalWithUpdates, UomType, GoalStatus, SharedGoal } from '@/lib/types'
import { uomOptions, quarterWindows } from '@/lib/constants'

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
  uom_type: 'numeric_min',
  target_value: '',
  target_date: '',
  weightage: '10',
}

export default function EmployeeGoalsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<GoalWithUpdates[]>([])
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<GoalFormData>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const myGoals = useMemo(() => goals.filter(g => g.employee_id === profile?.id), [goals, profile])
  const draftGoals = useMemo(() => myGoals.filter(g => g.status === 'draft'), [myGoals])
  const submittedGoals = useMemo(() => myGoals.filter(g => g.status === 'submitted'), [myGoals])
  const approvedGoals = useMemo(() => myGoals.filter(g => g.status === 'approved'), [myGoals])

  const weightageTotal = useMemo(() => draftGoals.reduce((sum, g) => sum + Number(g.weightage), 0), [draftGoals])

  const validationError = useMemo(() => {
    const count = draftGoals.length + (editingId ? 0 : 1)
    if (count > 8) return 'Maximum 8 goals allowed'
    const minWeight = Number(form.weightage)
    if (minWeight < 10) return 'Minimum 10% weightage per goal'
    if (editingId) return null
    const newTotal = weightageTotal + minWeight
    if (newTotal > 100) return `Total weightage would be ${newTotal}% (max 100%)`
    return null
  }, [draftGoals, editingId, form.weightage, weightageTotal])

  const canSubmit = useMemo(() => {
    return weightageTotal === 100 && draftGoals.length >= 1
  }, [weightageTotal, draftGoals])

  const fetchData = useCallback(async () => {
    if (!profile) return

    const [goalsRes, thrustRes, sharedRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('cycle_year', currentYear)
        .order('created_at', { ascending: false }),
      supabase.from('thrust_areas').select('*').order('name'),
      supabase.from('shared_goals').select('*'),
    ])

    const goalsData = (goalsRes.data || []) as Goal[]
    const thrustData = (thrustRes.data || []) as ThrustArea[]
    const sharedData = (sharedRes.data || []) as SharedGoal[]

    const thrustMap = new Map(thrustData.map(t => [t.id, t]))

    const goalsWithDetails: GoalWithUpdates[] = goalsData.map(g => ({
      ...g,
      thrust_area: thrustMap.get(g.thrust_area_id),
    }))

    setGoals(goalsWithDetails)
    setThrustAreas(thrustData)
    setSharedGoals(sharedData.filter(sg => !profile.department_id || sg.department_id === profile.department_id))
    setLoading(false)
  }, [supabase, profile])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async (asDraft: boolean = true) => {
    if (!profile) return

    setError('')
    setSaving(true)

    try {
      const goalData = {
        employee_id: profile.id,
        thrust_area_id: form.thrust_area_id,
        title: form.title,
        description: form.description || null,
        uom_type: form.uom_type,
        target_value: form.target_value ? Number(form.target_value) : null,
        target_date: form.target_date || null,
        weightage: Number(form.weightage),
        status: asDraft ? 'draft' : 'submitted',
        cycle_year: currentYear,
        locked: false,
        is_shared: false,
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('goals')
          .update(goalData)
          .eq('id', editingId)

        if (updateError) throw updateError
        setSuccess(editingId ? 'Goal updated!' : 'Goal saved as draft!')
      } else {
        const { error: insertError } = await supabase.from('goals').insert(goalData)
        if (insertError) throw insertError
        setSuccess('Goal saved as draft!')
      }

      setForm(emptyForm)
      setEditingId(null)
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save goal')
    } finally {
      setSaving(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const handleSubmitSheet = async () => {
    if (!profile) return
    setError('')
    setSaving(true)

    try {
      const { error } = await supabase
        .from('goals')
        .update({ status: 'submitted' })
        .eq('employee_id', profile.id)
        .eq('status', 'draft')
        .eq('cycle_year', currentYear)

      if (error) throw error
      setSuccess('Goal sheet submitted for approval!')
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
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
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return

    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (!error) {
      setSuccess('Goal deleted')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const handleSharedGoalWeightage = async (goalId: string, weightage: number) => {
    const { error } = await supabase
      .from('goals')
      .update({ weightage })
      .eq('id', goalId)

    if (!error) {
      setSuccess('Weightage updated')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const getStatusBadge = (status: GoalStatus, locked: boolean) => {
    const colors: Record<GoalStatus, string> = {
      draft: 'bg-slate-600',
      submitted: 'bg-yellow-600',
      approved: 'bg-green-600',
      rework: 'bg-red-600',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {locked && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <RoleLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </RoleLayout>
    )
  }

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Goals</h1>
            <p className="text-slate-400 mt-1">Create and manage your goals for {currentYear}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-400">Weightage Total</p>
              <p className={`text-2xl font-bold ${weightageTotal === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                {weightageTotal}%
              </p>
            </div>
            {canSubmit && (
              <button
                onClick={handleSubmitSheet}
                disabled={saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Submit Goal Sheet
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {approvedGoals.length === 0 && draftGoals.length < 8 && (
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingId ? 'Edit Goal' : 'Add New Goal'}
            </h2>

            {validationError && !editingId && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
                {validationError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Goal Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  placeholder="Enter goal title"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  rows={2}
                  placeholder="Describe your goal and success criteria"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Thrust Area *</label>
                <select
                  value={form.thrust_area_id}
                  onChange={e => setForm({ ...form, thrust_area_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                >
                  <option value="">Select thrust area</option>
                  {thrustAreas.map(ta => (
                    <option key={ta.id} value={ta.id}>{ta.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Unit of Measure *</label>
                <select
                  value={form.uom_type}
                  onChange={e => setForm({ ...form, uom_type: e.target.value as UomType })}
                  className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                >
                  {uomOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {['numeric_min', 'numeric_max', 'percent_min', 'percent_max'].includes(form.uom_type) && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Target Value *</label>
                  <input
                    type="number"
                    value={form.target_value}
                    onChange={e => setForm({ ...form, target_value: e.target.value })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    placeholder="Enter target"
                  />
                </div>
              )}

              {form.uom_type === 'timeline' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Target Date *</label>
                  <input
                    type="date"
                    value={form.target_date}
                    onChange={e => setForm({ ...form, target_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Weightage (%) *</label>
                <input
                  type="number"
                  value={form.weightage}
                  onChange={e => setForm({ ...form, weightage: e.target.value })}
                  min="10"
                  max="100"
                  className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleSave(true)}
                disabled={saving || !form.title || !form.thrust_area_id || (!form.target_value && form.uom_type !== 'timeline' && form.uom_type !== 'zero')}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving || validationError !== null || !canSubmit || !form.title || !form.thrust_area_id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Save & Continue
              </button>
              {editingId && (
                <button
                  onClick={() => { setEditingId(null); setForm(emptyForm); }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {sharedGoals.length > 0 && (
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Department Shared Goals</h2>
            <p className="text-sm text-slate-400 mb-4">These goals are assigned by your department. You can adjust the weightage.</p>
            <div className="space-y-3">
              {sharedGoals.map(sg => {
                const myGoal = myGoals.find(g => g.primary_goal_id === sg.id)
                return (
                  <div key={sg.id} className="flex items-center justify-between p-4 bg-[#081225] rounded-lg">
                    <div>
                      <p className="text-white font-medium">{sg.title}</p>
                      <p className="text-sm text-slate-400">{sg.description}</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Target: {sg.target_value} | UoM: {sg.uom_type}
                      </p>
                    </div>
                    {myGoal ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={myGoal.weightage}
                          onChange={e => handleSharedGoalWeightage(myGoal.id, Number(e.target.value))}
                          className="w-20 px-2 py-1 bg-[#0d1a36] border border-white/10 rounded text-white text-center"
                          min="0"
                          max="100"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                    ) : (
                      <span className="text-sm text-yellow-400">Not adopted</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Draft Goals ({draftGoals.length})</h3>
            {draftGoals.length === 0 ? (
              <p className="text-slate-400 text-sm">No draft goals yet</p>
            ) : (
              <div className="space-y-3">
                {draftGoals.map(g => (
                  <div key={g.id} className="p-3 bg-[#081225] rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-medium">{g.title}</p>
                        <p className="text-sm text-slate-400">{g.thrust_area?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-400 font-medium">{g.weightage}%</p>
                        {getStatusBadge(g.status, g.locked)}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(g)}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Submitted ({submittedGoals.length})</h3>
            {submittedGoals.length === 0 ? (
              <p className="text-slate-400 text-sm">No goals submitted</p>
            ) : (
              <div className="space-y-3">
                {submittedGoals.map(g => (
                  <div key={g.id} className="p-3 bg-[#081225] rounded-lg">
                    <p className="text-white font-medium">{g.title}</p>
                    <p className="text-sm text-slate-400">{g.thrust_area?.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-yellow-400 font-medium">{g.weightage}%</span>
                      {getStatusBadge(g.status, g.locked)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Approved ({approvedGoals.length})</h3>
            {approvedGoals.length === 0 ? (
              <p className="text-slate-400 text-sm">No approved goals yet</p>
            ) : (
              <div className="space-y-3">
                {approvedGoals.map(g => (
                  <div key={g.id} className="p-3 bg-[#081225] rounded-lg">
                    <p className="text-white font-medium">{g.title}</p>
                    <p className="text-sm text-slate-400">{g.thrust_area?.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-green-400 font-medium">{g.weightage}%</span>
                      {getStatusBadge(g.status, g.locked)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#0d1a36] border border-white/10 rounded-xl">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Validation Rules</h3>
          <ul className="text-sm text-slate-500 space-y-1">
            <li>• Minimum 1 goal required to submit</li>
            <li>• Maximum 8 goals per cycle</li>
            <li>• Each goal must have at least 10% weightage</li>
            <li>• Total weightage must equal 100% to submit</li>
            <li>• Once approved, goals are locked and cannot be edited</li>
          </ul>
        </div>
      </div>
    </RoleLayout>
  )
}