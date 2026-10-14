
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getValidDriveAccessToken } from '@/lib/googleDrive'

export async function GET(request: NextRequest) {
  try {
    // 1. Validate the user's Supabase session.
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    // 2. Ensure the server-side admin client is available.
    if (!supabaseAdmin) {
      console.error('Supabase admin client is not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    // 3. Resolve the student from the authenticated Auth user ID.
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('student_number')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (studentError) {
      console.error('Failed to resolve authenticated student:', studentError)
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

    // 4. Retrieve only this student's Google Drive access token.
    const accessToken = await getValidDriveAccessToken(
      student.student_number,
    )

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid Drive access for this student' },
        { status: 401 },
      )
    }

    // 5. Fetch PDF files from the authenticated student's Google Drive.
    const params = new URLSearchParams({
      q: "mimeType='application/pdf' and trashed=false",
      fields: 'files(id, name, size, modifiedTime, thumbnailLink)',
      orderBy: 'modifiedTime desc',
      pageSize: '50',
    })

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    )

    if (!driveResponse.ok) {
      console.error(
        'Google Drive files.list failed with status:',
        driveResponse.status,
      )

      return NextResponse.json(
        { error: 'Failed to list Drive files' },
        { status: 502 },
      )
    }

    const data = await driveResponse.json()

    return NextResponse.json(
      { files: data.files ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Drive files route failed:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
