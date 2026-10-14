
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const STATE_MAX_AGE_MS = 10 * 60 * 1000

type OAuthState = {
  student_number: number
  auth_user_id: string
  module_code: string
  issued_at: number
  nonce: string
}

function verifyOAuthState(
  state: string,
  secret: string,
): OAuthState | null {
  try {
    const parts = state.split('.')

    if (parts.length !== 2) return null

    const [encodedPayload, suppliedSignature] = parts

    const expectedSignature = createHmac('sha256', secret)
      .update(encodedPayload)
      .digest()

    const actualSignature = Buffer.from(
      suppliedSignature,
      'base64url',
    )

    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as OAuthState

    const now = Date.now()

    if (
      !Number.isSafeInteger(payload.student_number) ||
      payload.student_number <= 0 ||
      typeof payload.auth_user_id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(payload.auth_user_id) ||
      typeof payload.module_code !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,50}$/.test(payload.module_code) ||
      typeof payload.issued_at !== 'number' ||
      !Number.isFinite(payload.issued_at) ||
      payload.issued_at > now + 30_000 ||
      now - payload.issued_at > STATE_MAX_AGE_MS ||
      typeof payload.nonce !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(payload.nonce)
    ) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function redirectToStudy(request: NextRequest, destination: string) {
  return NextResponse.redirect(new URL(destination, request.url))
}

export async function GET(request: NextRequest) {
  const stateParam = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  const googleError = request.nextUrl.searchParams.get('error')

  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET

  if (!stateSecret || stateSecret.length < 32) {
    console.error('Google OAuth state secret is missing or too short')
    return redirectToStudy(
      request,
      '/StudyPage?drive_error=server_misconfigured',
    )
  }

  if (!stateParam) {
    return redirectToStudy(
      request,
      '/StudyPage?drive_error=invalid_state',
    )
  }

  const state = verifyOAuthState(stateParam, stateSecret)

  if (!state) {
    return redirectToStudy(
      request,
      '/StudyPage?drive_error=invalid_state',
    )
  }

  const backTo = `/StudyPage/${state.module_code}`

  if (googleError) {
    return redirectToStudy(
      request,
      `${backTo}?drive_error=access_denied`,
    )
  }

  if (!code) {
    return redirectToStudy(
      request,
      `${backTo}?drive_error=missing_params`,
    )
  }

  try {
    // Require the same authenticated user who initiated authorization.
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user || user.id !== state.auth_user_id) {
      return redirectToStudy(
        request,
        `${backTo}?drive_error=authentication_required`,
      )
    }

    if (!supabaseAdmin) {
      console.error('Supabase admin client is not initialized')
      return redirectToStudy(
        request,
        `${backTo}?drive_error=server_misconfigured`,
      )
    }

    // Confirm the signed student number still belongs to this user.
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('student_number')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (studentError) {
      console.error('Failed to verify student for OAuth callback')
      return redirectToStudy(
        request,
        `${backTo}?drive_error=verification_failed`,
      )
    }

    if (
      !student ||
      student.student_number !== state.student_number
    ) {
      return redirectToStudy(
        request,
        `${backTo}?drive_error=student_mismatch`,
      )
    }

    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Google Drive OAuth configuration is incomplete')
      return redirectToStudy(
        request,
        `${backTo}?drive_error=server_misconfigured`,
      )
    }

    // Exchange the authorization code for Google tokens.
    const tokenResponse = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
        cache: 'no-store',
      },
    )

    if (!tokenResponse.ok) {
      console.error(
        'Google token exchange failed with status:',
        tokenResponse.status,
      )
      return redirectToStudy(
        request,
        `${backTo}?drive_error=token_exchange_failed`,
      )
    }

    const tokens = await tokenResponse.json()

    const accessToken =
      typeof tokens.access_token === 'string'
        ? tokens.access_token
        : null

    const refreshToken =
      typeof tokens.refresh_token === 'string'
        ? tokens.refresh_token
        : null

    const expiresIn = Number(tokens.expires_in)

    if (
      !accessToken ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      return redirectToStudy(
        request,
        `${backTo}?drive_error=invalid_token_response`,
      )
    }

    // Google may omit refresh_token when the account was authorized before.
    // Preserve an existing refresh token rather than overwriting it with null.
    const { data: existingToken, error: existingTokenError } =
      await supabaseAdmin
        .from('google_tokens')
        .select('refresh_token')
        .eq('student_number', student.student_number)
        .maybeSingle()

    if (existingTokenError) {
      console.error('Failed to check existing Google token')
      return redirectToStudy(
        request,
        `${backTo}?drive_error=save_failed`,
      )
    }

    const effectiveRefreshToken =
      refreshToken || existingToken?.refresh_token

    if (!effectiveRefreshToken) {
      return redirectToStudy(
        request,
        `${backTo}?drive_error=no_refresh_token`,
      )
    }

    const expiresAt = new Date(
      Date.now() + expiresIn * 1000,
    ).toISOString()

    const { error: dbError } = await supabaseAdmin
      .from('google_tokens')
      .upsert(
        {
          student_number: student.student_number,
          refresh_token: effectiveRefreshToken,
          access_token: accessToken,
          access_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_number' },
      )

    if (dbError) {
      console.error('Failed to save Google Drive tokens')
      return redirectToStudy(
        request,
        `${backTo}?drive_error=save_failed`,
      )
    }

    return redirectToStudy(
      request,
      `${backTo}?drive_connected=true`,
    )
  } catch (error) {
    console.error('Google OAuth callback failed:', error)
    return redirectToStudy(
      request,
      `${backTo}?drive_error=internal_error`,
    )
  }
}
