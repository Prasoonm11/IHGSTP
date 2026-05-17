import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const AVATAR_BUCKET = process.env.NEXT_PUBLIC_PROFILE_AVATAR_BUCKET || 'profile-pictures'

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get('authorization')

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Supabase configuration is incomplete.' }, { status: 500 })
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const token = authHeader.slice('Bearer '.length)
  const serviceClient = createClient(url, serviceKey)
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token)

  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No image file provided.' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Please choose an image file.' }, { status: 400 })
  }

  const filePath = `avatars/${userData.user.id}/avatar`

  const { error: uploadError } = await serviceClient.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      cacheControl: '0',
      contentType: file.type,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data } = serviceClient.storage.from(AVATAR_BUCKET).getPublicUrl(filePath)

  return NextResponse.json({ publicUrl: data.publicUrl })
}
