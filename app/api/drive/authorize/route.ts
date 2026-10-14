
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client is not initialized')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('student_number')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (studentError) {
      console.error('Failed to resolve student:', studentError)
      return NextResponse.json(
        { error: 'Failed to verify student account' },
        { status: 500 },
      )
    }

    if (!student) {
      return NextResponse.json(
        { error: 'Student account not linked' },
        { status: 403 },
      )
    }

    const moduleCode = request.nextUrl.searchParams.get('module_code')

    if (
      !moduleCode ||
      moduleCode.length > 50 ||
      !/^[a-zA-Z0-9_-]+$/.test(moduleCode)
    ) {
      return NextResponse.json(
        { error: 'Invalid or missing module_code' },
        { status: 400 },
      )
    }

    const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET

    if (!stateSecret || stateSecret.length < 32) {
      console.error('GOOGLE_OAUTH_STATE_SECRET is missing or too short')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
    const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI

    if (!clientId || !redirectUri) {
      console.error('Google Drive OAuth configuration is incomplete')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    const statePayload = {
      student_number: student.student_number,
      auth_user_id: user.id,
      module_code: moduleCode,
      issued_at: Date.now(),
      nonce: crypto.randomUUID(),
    }

    const encodedPayload = Buffer
      .from(JSON.stringify(statePayload))
      .toString('base64url')

    const signature = createHmac('sha256', stateSecret)
      .update(encodedPayload)
      .digest('base64url')

    const state = `${encodedPayload}.${signature}`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    return NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    )
  } catch (error) {
    console.error('Google Drive authorization failed:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
