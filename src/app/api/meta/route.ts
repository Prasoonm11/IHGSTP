import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in environment' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)

  const { data: departments, error: deptErr } = await supabase.from('departments').select('id, name').order('name')
  if (deptErr) return NextResponse.json({ error: deptErr.message }, { status: 500 })

  const { data: managers, error: mgrErr } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, department_id, manager_id')
    .eq('role', 'manager')
    .order('first_name')

  if (mgrErr) return NextResponse.json({ error: mgrErr.message }, { status: 500 })

  return NextResponse.json({ departments, managers })
}
