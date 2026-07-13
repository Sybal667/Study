import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function getValidDriveAccessToken(studentNumber: number): Promise<string | null> {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin is not initialized — check SUPABASE_SERVICE_ROLE_KEY')
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('google_tokens')
    .select('access_token, refresh_token, access_token_expires_at')
    .eq('student_number', studentNumber)
    .single()

  if (error || !data) {
    console.error('No Drive tokens found for student:', studentNumber, error)
    return null
  }

  const expiresAt = data.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() : 0
  const isExpired = Date.now() > expiresAt - 60_000 // treated as expired 60s early, avoid edge-of-expiry failures

  if (!isExpired && data.access_token) {
    return data.access_token
  }

  // Access token is expired
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = await tokenResponse.json()

  if (!tokenResponse.ok) {
    console.error('Failed to refresh Drive access token:', tokens)
    return null
  }

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('google_tokens')
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('student_number', studentNumber)

  if (updateError) {
    console.error('Failed to save refreshed Drive access token:', updateError)
  }

  return tokens.access_token
}