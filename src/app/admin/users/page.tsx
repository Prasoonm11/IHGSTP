'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Department, Role } from '@/lib/types'
import { AnimatedNumber, CardGradient, PageHeader, LoadingSpinner, Badge, EmptyState, GradientButton, animationStyles } from '@/components/ui/animations'
import { getTimeGreeting } from '@/lib/time'

const currentYear = new Date().getFullYear()

const roleConfig: Record<Role, { gradient: string; icon: string }> = {
  employee: { gradient: 'from-blue-500 to-indigo-600', icon: '👤' },
  manager: { gradient: 'from-purple-500 to-pink-600', icon: '👔' },
  admin: { gradient: 'from-rose-500 to-red-600', icon: '⚡' },
}

export default function AdminUsersPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [users, setUsers] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'employee' as Role,
    department_id: '',
    manager_id: '',
    is_active: true,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = searchQuery
        ? `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(searchQuery.toLowerCase())
        : true
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesDept = deptFilter === 'all' || u.department_id === deptFilter
      return matchesSearch && matchesRole && matchesDept
    })
  }, [users, searchQuery, roleFilter, deptFilter])

  const managers = useMemo(() => users.filter(u => u.role === 'manager' || u.role === 'admin'), [users])
  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments])

  const stats = useMemo(() => ({
    total: users.length,
    employees: users.filter(u => u.role === 'employee').length,
    managers: users.filter(u => u.role === 'manager').length,
    admins: users.filter(u => u.role === 'admin').length,
  }), [users])

  const fetchData = useCallback(async () => {
    const [usersRes, deptRes] = await Promise.all([
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
    ])

    setUsers((usersRes.data || []) as Profile[])
    setDepartments((deptRes.data || []) as Department[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOpenModal = (user?: Profile) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department_id: user.department_id || '',
        manager_id: user.manager_id || '',
        is_active: true,
      })
    } else {
      setEditingUser(null)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        role: 'employee',
        department_id: '',
        manager_id: '',
        is_active: true,
      })
    }
    setShowModal(true)
    setError('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      if (editingUser) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role,
            department_id: formData.department_id || null,
            manager_id: formData.manager_id || null,
          })
          .eq('id', editingUser.id)

        if (updateError) throw updateError
        setSuccess('User updated successfully!')
      } else {
        setError('New user creation requires registration through the auth system')
      }

      setShowModal(false)
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id)

      if (!error) {
        setSuccess(`User ${user.is_active ? 'deactivated' : 'activated'}`)
        await fetchData()
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleUnlockGoal = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ locked: false })
        .eq('employee_id', userId)
        .eq('cycle_year', currentYear)
        .eq('locked', true)

      if (!error) {
        setSuccess('All locked goals unlocked for this user')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unlock')
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

  return (
    <RoleLayout>
      <style>{animationStyles}</style>
      <div className="max-w-6xl mx-auto space-y-8 pb-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">{getTimeGreeting()}, {profile?.first_name}</h1>
            <p className="text-violet-300/60 mt-2">Manage users, roles, and organization hierarchy</p>
          </div>
          
        </div>

        {error && (
          <div className="p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 animate-fade-in-up">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 animate-fade-in-up">
            {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Users', value: stats.total, icon: '👥', color: 'indigo' },
            { label: 'Employees', value: stats.employees, icon: '👤', color: 'blue' },
            { label: 'Managers', value: stats.managers, icon: '👔', color: 'purple' },
            { label: 'Admins', value: stats.admins, icon: '⚡', color: 'rose' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-violet-300/60">{stat.label}</p>
                <div className={`w-12 h-12 rounded-lg bg-${stat.color}-500/20 flex items-center justify-center text-xl`}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-3xl font-bold text-white">
                <AnimatedNumber value={stat.value} />
              </p>
            </div>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Search & Filter</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">All Roles</option>
              <option value="employee">Employees</option>
              <option value="manager">Managers</option>
              <option value="admin">Admins</option>
            </select>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500/50"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white">User Directory</h2>
            <p className="text-violet-300/60 text-sm mt-1">Showing {filteredUsers.length} of {users.length} users</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-white/60 text-sm border-b border-white/10">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Department</th>
                  <th className="p-4 font-medium">Manager</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const manager = users.find(u => u.id === user.manager_id)
                  const config = roleConfig[user.role]

                  return (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${config.gradient} flex items-center justify-center text-white font-bold shadow-lg text-sm`}>
                            {user.first_name[0]}{user.last_name[0]}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-white/50 text-sm">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 text-violet-300 capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-white/70">{deptMap.get(user.department_id ?? '') || '-'}</td>
                      <td className="p-4 text-white/70">{manager ? `${manager.first_name} ${manager.last_name}` : '-'}</td>
                      <td className="p-4">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${
                          user.is_active 
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}>
                          {user.is_active ? '🟢 Active' : '⚫ Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(user)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all text-sm text-violet-300 hover:text-violet-100"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all text-sm text-white/60 hover:text-white"
                          >
                            {user.is_active ? '🔒' : '🔓'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
            <CardGradient gradient="from-slate-800/90 to-slate-900/90" className="p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-white mb-4">
                {editingUser ? 'Edit User' : 'Add User'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 text-sm">First Name</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 text-sm">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-white/50 text-sm">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/50"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-sm">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="text-white/50 text-sm">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">No Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-white/50 text-sm">Manager</label>
                  <select
                    value={formData.manager_id}
                    onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">No Manager</option>
                    {managers.filter(m => m.id !== editingUser?.id).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <GradientButton
                  onClick={() => setShowModal(false)}
                  gradient="from-slate-500 to-slate-600"
                  className="flex-1"
                >
                  Cancel
                </GradientButton>
                <GradientButton
                  onClick={handleSave}
                  disabled={saving}
                  gradient="from-cyan-500 to-blue-500"
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save'}
                </GradientButton>
              </div>
            </CardGradient>
          </div>
        )}
      </div>
    </RoleLayout>
  )
}