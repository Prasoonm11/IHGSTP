import createServiceClient from './supabase/server'

export async function getUserFromAccessToken(accessToken: string | null) {
  if (!accessToken) return { user: null, error: 'no_token' }
  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.getUser(accessToken)
  return { user: data?.user ?? null, error }
}

export async function getProfileById(userId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return { profile: data ?? null, error }
}

export async function requireRole(userId: string | null, roles: string[] = []) {
  if (!userId) return { allowed: false, reason: 'not_authenticated' }
  const { profile, error } = await getProfileById(userId as string)
  if (error) return { allowed: false, reason: 'profile_lookup_failed' }
  if (roles.length === 0) return { allowed: true, profile }
  return { allowed: roles.includes(profile.role), profile }
}

export default {
  getUserFromAccessToken,
  getProfileById,
  requireRole
}
