'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/lib/types'

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (payload: {
    firstName: string
    lastName: string
    email: string
    password: string
    role: Role
    departmentId: string | null
    managerId: string | null
  }) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser()
    const authUser = authData.user

    if (!authUser) {
      setProfile(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role, department_id, manager_id')
      .eq('id', authUser.id)
      .single()

    if (error) {
      setProfile(null)
    } else {
      setProfile(data as Profile)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    queueMicrotask(() => {
      void loadProfile()
    })
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadProfile()
    })

    return () => data.subscription.unsubscribe()
  }, [loadProfile, supabase])

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp: AuthContextType['signUp'] = async ({
    firstName,
    lastName,
    email,
    password,
    role,
    departmentId,
    managerId
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } }
    })

    if (error) return { error: error.message }
    if (!data.user) return { error: 'Unable to create user.' }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      department_id: departmentId,
      manager_id: managerId
    })

    if (profileError) return { error: profileError.message }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile: loadProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
