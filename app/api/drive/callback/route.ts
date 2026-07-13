import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
if (!supabaseAdmin) {
    console.error('supabaseAdmin is not initialized — check SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.redirect(new URL('/StudyPage?drive_error=server_misconfigured', request.url))
  }
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  let studentNumber: string | null = null
  let moduleCode: string | null = null

  if (stateParam) {
    try {
      const parsed = JSON.parse(stateParam)
      studentNumber = parsed.student_number
      moduleCode = parsed.module_code
    } catch {
    }
  }

  const backTo = moduleCode ? `/StudyPage/${moduleCode}` : '/StudyPage'

  if (error) {
    return NextResponse.redirect(new URL(`${backTo}?drive_error=access_denied`, request.url))
  }

  if (!code || !studentNumber) {
    return NextResponse.redirect(new URL(`${backTo}?drive_error=missing_params`, request.url))
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
    }),
  })

  const tokens = await tokenResponse.json()

  if (!tokenResponse.ok) {
    console.error('Google token exchange failed:', tokens)
    return NextResponse.redirect(new URL(`${backTo}?drive_error=token_exchange_failed`, request.url))
  }

  const { access_token, refresh_token, expires_in } = tokens

  if (!refresh_token) {
    console.error('No refresh_token returned from Google:', tokens)
    return NextResponse.redirect(new URL(`${backTo}?drive_error=no_refresh_token`, request.url))
  }

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  const { error: dbError } = await supabaseAdmin
    .from('google_tokens')
    .upsert(
      {
        student_number: parseInt(studentNumber),
        refresh_token,
        access_token,
        access_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_number' }
    )

  if (dbError) {
    console.error('Failed to save Drive tokens:', dbError)
    return NextResponse.redirect(new URL(`${backTo}?drive_error=save_failed`, request.url))
  }

  return NextResponse.redirect(new URL(`${backTo}?drive_connected=true`, request.url))
}