import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in environment' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)

  const seed = [
    { name: 'Engineering' },
    { name: 'Sales' },
    { name: 'Operations' },
    { name: 'HR' }
  ]

  const { error } = await supabase.from('departments').upsert(seed, { onConflict: 'name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
