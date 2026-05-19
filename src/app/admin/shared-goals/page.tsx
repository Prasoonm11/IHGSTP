'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Department, Goal, Profile, ThrustArea, UomType } from '@/lib/types'
import { uomOptions } from '@/lib/constants'
import { LoadingBar } from '@/components/ui/animations'

const currentYear = new Date().getFullYear()

interface SharedGoalWithDept extends Goal {
  department?: Department
}

const DEPARTMENT_META_PREFIX = 'dept_id:'

function encodeSharedGoalDescription(description: string, departmentId: string) {
  return `${DEPARTMENT_META_PREFIX}${departmentId}\n${description}`
}

function decodeSharedGoalDepartmentId(description: string | null) {
  if (!description?.startsWith(DEPARTMENT_META_PREFIX)) return null
  const [meta] = description.split('\n', 1)
  return meta.slice(DEPARTMENT_META_PREFIX.length) || null
}

function decodeSharedGoalDescription(description: string | null) {
  if (!description?.startsWith(DEPARTMENT_META_PREFIX)) return description || ''
  return description.split('\n').slice(1).join('\n')
}

export default function AdminSharedGoalsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [sharedGoals, setSharedGoals] = useState<Goal[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    uom_type: 'numeric_min' as UomType,
    target_value: '',
    target_date: '',
    weightage: '10',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])
  const goalsByDept = useMemo(() => {
    return sharedGoals.map(sg => ({
      ...sg,
      description: decodeSharedGoalDescription(sg.description),
      department: deptMap.get(decodeSharedGoalDepartmentId(sg.description) ?? ''),
    })).filter(sg => Boolean(sg.department))
  }, [sharedGoals, deptMap])
  const defaultThrustAreaId = useMemo(() => thrustAreas[0]?.id ?? '', [thrustAreas])

  const fetchData = useCallback(async () => {
    const [sharedRes, deptRes, goalsRes, profilesRes, thrustRes] = await Promise.all([
      // fetch only primary shared goals (primary_goal_id IS NULL) so pushed copies aren't listed here
      supabase.from('goals').select('*').eq('is_shared', true).is('primary_goal_id', null).eq('cycle_year', currentYear).order('created_at', { ascending: false }),
      supabase.from('departments').select('*').order('name'),
      supabase.from('goals').select('*').eq('cycle_year', currentYear),
      supabase.from('profiles').select('*'),
      supabase.from('thrust_areas').select('*').order('name'),
    ])

    setSharedGoals((sharedRes.data || []) as Goal[])
    setDepartments((deptRes.data || []) as Department[])
    setGoals((goalsRes.data || []) as Goal[])
    setProfiles((profilesRes.data || []) as Profile[])
    setThrustAreas((thrustRes.data || []) as ThrustArea[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async () => {
    if (!profile) return
    setSaving(true)
    setError('')

    try {
      if (formData.uom_type === 'timeline' && !formData.target_date) {
        throw new Error('Please select a target date for timeline goals')
      }
      if (!defaultThrustAreaId) {
        throw new Error('No thrust area is available to attach this shared goal')
      }

      const { error: insertError } = await supabase.from('goals').insert({
        employee_id: profile.id,
        thrust_area_id: defaultThrustAreaId,
        title: formData.title,
        description: formData.department_id
          ? encodeSharedGoalDescription(formData.description || '', formData.department_id)
          : (formData.description || null),
        target_date: formData.uom_type === 'timeline' ? formData.target_date || null : null,
        uom_type: formData.uom_type,
        target_value: formData.target_value ? Number(formData.target_value) : null,
        weightage: Number(formData.weightage),
        status: 'submitted',
        cycle_year: currentYear,
        locked: true,
        is_shared: true,
        primary_goal_id: null,
      })

      if (insertError) throw insertError

      setSuccess('Shared goal created!')
      setShowModal(false)
      setFormData({
        title: '',
        description: '',
        department_id: '',
        uom_type: 'numeric_min',
        target_value: '',
        target_date: '',
        weightage: '10',
      })
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create shared goal')
    } finally {
      setSaving(false)
    }
  }

  const handlePushToEmployees = async (sharedGoal: Goal) => {
    const departmentId = decodeSharedGoalDepartmentId(sharedGoal.description)
    const deptEmployees = profiles.filter(p => {
      if (p.role !== 'employee') return false
      if (!departmentId) return true
      return p.department_id === departmentId
    })

    if (deptEmployees.length === 0) {
      alert('No employees found in this department')
      return
    }

    setSaving(true)
    try {
      let pushed = 0
      for (const emp of deptEmployees) {
        // remove any employee-created draft with the same title to avoid duplicates
        const existingDraft = goals.find(g =>
          g.employee_id === emp.id &&
          g.status === 'draft' &&
          g.title === sharedGoal.title
        )

        if (existingDraft) {
          // update the employee draft to become the pushed shared goal instead of deleting it
          const { error: updateError } = await supabase
            .from('goals')
            .update({
              weightage: sharedGoal.weightage,
              target_value: sharedGoal.target_value,
              target_date: sharedGoal.target_date,
              status: 'submitted',
              locked: true,
              primary_goal_id: sharedGoal.id,
              is_shared: true,
            })
            .eq('id', existingDraft.id)

          if (updateError) {
            console.error('Failed to update existing draft for', emp.id, updateError)
            // continue — don't block the push for one failure
          } else {
            try {
              await supabase.from('notifications').insert({
                user_id: emp.id,
                type: 'shared_goal_pushed',
                payload: {
                  message: `A shared goal "${sharedGoal.title}" was pushed to you by ${profile?.first_name} ${profile?.last_name}.`,
                  shared_goal_id: sharedGoal.id,
                  primary_goal_id: existingDraft.id,
                  cycle_year: currentYear,
                },
              })
            } catch (notifyErr) {
              console.error('Failed to send notification to', emp.id, notifyErr)
            }
            pushed++
            continue
          }
        }

        const existingGoal = goals.find(g =>
          g.employee_id === emp.id &&
          g.is_shared &&
          (g.primary_goal_id === sharedGoal.id || g.title === sharedGoal.title)
        )

        if (existingGoal) {
          const { error } = await supabase
            .from('goals')
            .update({
              weightage: sharedGoal.weightage,
              target_value: sharedGoal.target_value,
              target_date: sharedGoal.target_date,
              status: 'submitted',
              locked: true,
              primary_goal_id: sharedGoal.id,
            })
            .eq('id', existingGoal.id)

          if (error) {
            console.error('Failed to update existing goal for', emp.id, error)
            throw error
          } else {
            // notify employee that their goal was pushed/updated by admin
            try {
              await supabase.from('notifications').insert({
                user_id: emp.id,
                type: 'shared_goal_pushed',
                payload: {
                  message: `A shared goal "${sharedGoal.title}" was pushed to you by ${profile?.first_name} ${profile?.last_name}.`,
                  shared_goal_id: sharedGoal.id,
                  primary_goal_id: existingGoal.id,
                  cycle_year: currentYear,
                },
              })
            } catch (notifyErr) {
              console.error('Failed to send notification to', emp.id, notifyErr)
            }
            pushed++
          }
        } else {
          const { error } = await supabase.from('goals').insert({
            employee_id: emp.id,
            thrust_area_id: sharedGoal.thrust_area_id,
            title: sharedGoal.title,
            description: sharedGoal.description,
            uom_type: sharedGoal.uom_type,
            target_value: sharedGoal.target_value,
            target_date: sharedGoal.target_date,
            weightage: sharedGoal.weightage,
            status: 'submitted',
            cycle_year: currentYear,
            locked: true,
            is_shared: true,
            primary_goal_id: sharedGoal.id,
          })

          if (error) {
            console.error('Failed to insert goal for', emp.id, error)
            throw error
          } else {
            // notify employee that a new shared goal was pushed to them
            try {
              await supabase.from('notifications').insert({
                user_id: emp.id,
                type: 'shared_goal_pushed',
                payload: {
                  message: `A shared goal "${sharedGoal.title}" was pushed to you by ${profile?.first_name} ${profile?.last_name}.`,
                  shared_goal_id: sharedGoal.id,
                  primary_goal_id: null,
                  cycle_year: currentYear,
                },
              })
            } catch (notifyErr) {
              console.error('Failed to send notification to', emp.id, notifyErr)
            }
            pushed++
          }
        }
      }

      setSuccess(`Pushed to ${pushed} employees!`)
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      console.error('Error pushing shared goals:', err)
      setError(err instanceof Error ? err.message : 'Failed to push shared goals')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    // Check for pushed/shared child goals first
    try {
      const { data: children, error: childError } = await supabase
        .from('goals')
        .select('id,status,employee_id')
        .eq('primary_goal_id', id)

      if (childError) {
        console.error('Failed to check dependent goals for', id, childError)
        setError('Unable to verify whether this shared goal was pushed. Try again later.')
        return
      }

      const childCount = (children || []).length
      if (childCount > 0) {
        // Build a helpful message for the admin explaining why deletion is blocked
        const hasActive = (children || []).some((c: any) => c.status !== 'draft')
        const msg = hasActive
          ? `This shared goal cannot be deleted because it was already pushed to ${childCount} employee(s) and at least one pushed goal is not a draft (submitted/approved). Remove or convert the pushed goals before deleting the shared KPI.`
          : `This shared goal cannot be deleted because it was pushed to ${childCount} employee(s). Remove the pushed drafts before deleting the shared KPI.`

        alert(msg)
        return
      }
    } catch (err: unknown) {
      console.error('Error checking dependent goals:', err)
      setError('Failed to verify dependent goals')
      return
    }

    const confirmation = prompt('Type DELETE to confirm removing this shared goal. This action is irreversible.')
    if (confirmation !== 'DELETE') return

    try {
      console.log('Admin confirmed deletion of shared goal', id)
      const { error } = await supabase.from('goals').delete().eq('id', id).eq('is_shared', true)
      if (!error) {
        setSuccess('Shared goal deleted')
        await fetchData()
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err: unknown) {
      // If delete failed due to FK or other DB constraint, explain to admin
      console.error('Failed to delete shared goal:', err)
      alert('Unable to delete this shared goal. It may have been pushed or referenced by employee goals. Remove pushed goals first or contact the administrator.')
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  if (loading) {
    return (
      <RoleLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingBar />
        </div>
      </RoleLayout>
    )
  }

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Shared KPIs</h1>
            <p className="text-slate-400 mt-1">Create and push department-level goals to employees</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Create Shared Goal
          </button>
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

        {sharedGoals.length === 0 ? (
          <div className="text-center py-12 bg-[#0d1a36] border border-white/10 rounded-xl">
            <p className="text-slate-400">No shared goals created yet.</p>
            <p className="text-slate-500 text-sm mt-2">Create shared KPIs to push to your team.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {goalsByDept.map(sg => {
              const departmentId = decodeSharedGoalDepartmentId(sg.description)
              const deptEmployees = profiles.filter(p => {
                if (p.role !== 'employee') return false
                if (!departmentId) return true
                return p.department_id === departmentId
              }).length

              const pushedCount = goals.filter(g => g.primary_goal_id === sg.id).length
              const pushedToAll = pushedCount >= deptEmployees

              return (
                <div key={sg.id} className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{sg.title}</h3>
                      <p className="text-sm text-slate-400">{sg.department?.name || 'All Departments'}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(sg.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {decodeSharedGoalDescription(sg.description) && (
                    <p className="text-sm text-slate-400 mb-4">{decodeSharedGoalDescription(sg.description)}</p>
                  )}

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-[#081225] rounded-lg text-center">
                      <p className="text-lg font-bold text-white">
                        {sg.uom_type === 'timeline'
                          ? (sg.target_date ? new Date(sg.target_date).toLocaleDateString() : '-')
                          : (sg.target_value ?? '-')}
                      </p>
                      <p className="text-xs text-slate-500">{sg.uom_type === 'timeline' ? 'Target Date' : 'Target'}</p>
                    </div>
                    <div className="p-3 bg-[#081225] rounded-lg text-center">
                      <p className="text-lg font-bold text-white">{sg.weightage}%</p>
                      <p className="text-xs text-slate-500">Weightage</p>
                    </div>
                    <div className="p-3 bg-[#081225] rounded-lg text-center">
                      <p className="text-lg font-bold text-white">{deptEmployees}</p>
                      <p className="text-xs text-slate-500">Employees</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePushToEmployees(sg)}
                    disabled={saving || pushedToAll}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {pushedToAll ? `Pushed to ${pushedCount} employees` : (saving ? 'Pushing...' : 'Push to Employees')}
                  </button>

                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Employees can only edit weightage. Title and target are read-only.
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Create Shared Goal</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    placeholder="e.g., Increase Customer Satisfaction"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    placeholder="Optional description..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Department</label>
                    <select
                      value={formData.department_id}
                      onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    >
                      <option value="">All Departments</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Unit of Measure</label>
                    <select
                      value={formData.uom_type}
                      onChange={e => setFormData({
                        ...formData,
                        uom_type: e.target.value as UomType,
                        target_value: e.target.value === 'timeline' ? '' : formData.target_value,
                        target_date: e.target.value === 'timeline' ? formData.target_date : '',
                      })}
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    >
                      {uomOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      {formData.uom_type === 'timeline' ? 'Target Date' : 'Target Value'}
                    </label>
                    <input
                      type={formData.uom_type === 'timeline' ? 'date' : 'number'}
                      value={formData.uom_type === 'timeline' ? formData.target_date : formData.target_value}
                      onChange={e => setFormData({
                        ...formData,
                        target_date: formData.uom_type === 'timeline' ? e.target.value : '',
                        target_value: formData.uom_type === 'timeline' ? '' : e.target.value,
                      })}
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                      placeholder={formData.uom_type === 'timeline' ? 'Select a date' : 'e.g., 95'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Weightage (%)</label>
                    <input
                      type="number"
                      value={formData.weightage}
                      onChange={e => setFormData({ ...formData, weightage: e.target.value })}
                      min="10"
                      max="100"
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !formData.title}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleLayout>
  )
}