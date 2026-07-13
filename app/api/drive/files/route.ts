import { NextRequest, NextResponse } from 'next/server'
import { getValidDriveAccessToken } from '@/lib/googleDrive'

export async function GET(request: NextRequest) {
  const studentNumberParam = request.nextUrl.searchParams.get('student_number')

  if (!studentNumberParam) {
    return NextResponse.json({ error: 'Missing student_number' }, { status: 400 })
  }

  const studentNumber = parseInt(studentNumberParam)

  const accessToken = await getValidDriveAccessToken(studentNumber)

  if (!accessToken) {
    return NextResponse.json({ error: 'No valid Drive access for this student' }, { status: 401 })
  }

  const params = new URLSearchParams({
    q: "mimeType='application/pdf' and trashed=false",
    fields: 'files(id, name, size, modifiedTime, thumbnailLink)',
    orderBy: 'modifiedTime desc',
    pageSize: '50',
  })

  const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await driveResponse.json()

  if (!driveResponse.ok) {
    console.error('Drive files.list failed:', data)
    return NextResponse.json({ error: 'Failed to list Drive files' }, { status: 500 })
  }

  return NextResponse.json({ files: data.files ?? [] })
}