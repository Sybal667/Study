import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const studentNumber = request.nextUrl.searchParams.get('student_number')
  const moduleCode = request.nextUrl.searchParams.get('module_code')

  if (!studentNumber || !moduleCode) {
    return NextResponse.json({ error: 'Missing student_number or module_code' }, { status: 400 })
  }

  const state = JSON.stringify({ student_number: studentNumber, module_code: moduleCode })

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return NextResponse.redirect(authUrl)
}