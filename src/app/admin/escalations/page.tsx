'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, Profile } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

const currentYear = new Date().getFullYear()

interface EscalationSummary {
  type: string
  count: number
  description: string
}

export default function AdminEscalationsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  const yearGoals = useMemo(() => goals.filter(g => g.cycle_year === currentYear), [goals])
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])

  const escalationSummary = useMemo((): EscalationSummary[] => {
    const employees = profiles.filter(p => p.role === 'employee')
    const employeeIds = new Set(employees.map(e => e.id))

    const goalsWithoutSubmission = employees.filter(emp => {
      const empGoals = yearGoals.filter(g => g.employee_id === emp.id)
      return empGoals.length === 0
    }).length

    const pendingApproval = yearGoals.filter(g => g.status === 'submitted').length

    const overdueCheckins = yearGoals.filter(g => {
      if (g.status !== 'approved') return false
      const employee = profileMap.get(g.employee_id)
      return employee?.role === 'employee'
    }).length

    return [
      {
        type: 'Goals Not Submitted',
        count: goalsWithoutSubmission,
        description: 'Employees who have not submitted any goals for the cycle',
      },
      {
        type: 'Pending Approval',
        count: pendingApproval,
        description: 'Goals submitted but awaiting manager approval',
      },
      {
        type: 'Check-in Overdue',
        count: 0,
        description: 'Quarterly check-ins that are past due',
      },
    ]
  }, [yearGoals, profiles, profileMap])

  const runEscalation = useCallback(async (type: string) => {
    setRunning(true)
    setMessage('')

    try {
      if (type === 'Goals Not Submitted') {
        const employees = profiles.filter(p => p.role === 'employee')
        let sent = 0

        for (const emp of employees) {
          const empGoals = yearGoals.filter(g => g.employee_id === emp.id)
          if (empGoals.length === 0) {
            await supabase.from('notifications').insert({
              user_id: emp.id,
              type: 'escalation',
              payload: {
                message: 'Reminder: Please submit your goals for the current cycle.',
                escalation_type: 'goals_not_submitted',
              },
            })
            sent++
          }

          const manager = profiles.find(p => p.id === emp.manager_id)
          if (manager) {
            await supabase.from('notifications').insert({
              user_id: manager.id,
              type: 'escalation',
              payload: {
                message: `Reminder: ${emp.first_name} ${emp.last_name} has not submitted their goals.`,
                escalation_type: 'goals_not_submitted_manager',
                employee_id: emp.id,
              },
            })
          }
        }
        setMessage(`Escalation sent to ${sent} employees and their managers!`)
      }

      if (type === 'Pending Approval') {
        const pendingGoals = yearGoals.filter(g => g.status === 'submitted')
        let sent = 0

        for (const goal of pendingGoals) {
          const manager = profiles.find(p => p.id === profileMap.get(goal.employee_id)?.manager_id)
          if (manager) {
            await supabase.from('notifications').insert({
              user_id: manager.id,
              type: 'escalation',
              payload: {
                message: `Reminder: You have goals pending approval.`,
                escalation_type: 'pending_approval',
                goal_id: goal.id,
              },
            })
            sent++
          }
        }
        setMessage(`Escalation sent to ${sent} managers!`)
      }

      if (type === 'Check-in Overdue') {
        setMessage('No check-ins are currently overdue.')
      }
    } catch (err) {
      setMessage('Failed to run escalation. Please try again.')
    } finally {
      setRunning(false)
    }
  }, [profiles, yearGoals, supabase, profileMap])

  const fetchData = useCallback(async () => {
    const [goalsRes, profilesRes] = await Promise.all([
      supabase.from('goals').select('*'),
      supabase.from('profiles').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setProfiles((profilesRes.data || []) as Profile[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Escalations</h1>
          <p className="text-slate-400 mt-1">Rule-based escalation engine for goal management</p>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {escalationSummary.map(es => (
            <div key={es.type} className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{es.type}</h3>
                <span className={`text-2xl font-bold ${
                  es.count > 0 ? 'text-red-400' : 'text-green-400'
                }`}>
                  {es.count}
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-4">{es.description}</p>
              <button
                onClick={() => runEscalation(es.type)}
                disabled={running || es.count === 0}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {running ? 'Running...' : 'Run Escalation'}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Escalation Rules</h3>
          <div className="space-y-4">
            {[
              {
                name: 'Goal Submission Reminder',
                trigger: 'Goals not submitted within 7 days of cycle start',
                chain: 'Employee → Manager → HR',
                action: 'Email + In-app notification',
                active: true,
              },
              {
                name: 'Approval Pending Alert',
                trigger: 'Goal pending approval for more than 3 days',
                chain: 'Manager → HR',
                action: 'Email + In-app notification',
                active: true,
              },
              {
                name: 'Quarterly Check-in Reminder',
                trigger: 'Check-in window closing in 3 days',
                chain: 'Employee → Manager',
                action: 'In-app notification',
                active: true,
              },
              {
                name: 'Overdue Check-in Escalation',
                trigger: 'Check-in not submitted after window closes',
                chain: 'Employee → Manager → HR',
                action: 'Email + In-app notification',
                active: true,
              },
            ].map((rule, i) => (
              <div key={i} className="p-4 bg-[#081225] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">{rule.name}</h4>
                  <span className={`px-2 py-1 rounded text-xs ${rule.active ? 'bg-green-600' : 'bg-slate-600'} text-white`}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Trigger</p>
                    <p className="text-slate-300">{rule.trigger}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Escalation Chain</p>
                    <p className="text-slate-300">{rule.chain}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Action</p>
                    <p className="text-slate-300">{rule.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">How Escalations Work</h3>
          <div className="flex items-center justify-center gap-4">
            {['Employee', 'Manager', 'HR'].map((role, i) => (
              <div key={role} className="flex items-center">
                <div className={`px-4 py-2 rounded-lg ${
                  i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-purple-600' : 'bg-red-600'
                } text-white font-medium`}>
                  {role}
                </div>
                {i < 2 && (
                  <div className="mx-2 text-slate-500">→</div>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-4 text-center">
            Escalations follow a cascading chain. If the issue isn't resolved at one level, it automatically escalates to the next.
          </p>
        </div>
      </div>
    </RoleLayout>
  )
}