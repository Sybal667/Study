import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getValidDriveAccessToken } from '@/lib/googleDrive'

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin is not initialized — check SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const body = await request.json()
  const { student_number, module_id, file_id, file_name } = body

  if (!student_number || !module_id || !file_id || !file_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const accessToken = await getValidDriveAccessToken(parseInt(student_number))

  if (!accessToken) {
    return NextResponse.json({ error: 'No valid Drive access for this student' }, { status: 401 })
  }

  const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!driveResponse.ok) {
    const errText = await driveResponse.text()
    console.error('Drive file download failed:', errText)
    return NextResponse.json({ error: 'Failed to download file from Drive' }, { status: 500 })
  }

  const fileBuffer = await driveResponse.arrayBuffer()
  const storageFileName = `${Date.now()}_${file_name}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('pdfs')
    .upload(`students/${storageFileName}`, Buffer.from(fileBuffer), {
      contentType: 'application/pdf',
    })

  if (uploadError) {
    console.error('Supabase storage upload failed:', uploadError)
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('pdfs').getPublicUrl(`students/${storageFileName}`)

const { data: insertedRow, error: dbError } = await supabaseAdmin
    .from('student_pdfs')
    .insert({
      student_number: parseInt(student_number),
      module_id: parseInt(module_id),
      file_name,
      file_url: publicUrl,
    })
    .select('pdf_id')
    .single()

  if (dbError || !insertedRow) {
    console.error('Failed to insert student_pdfs row:', dbError)
    return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 })
  }

  return NextResponse.json({ file_url: publicUrl, pdf_id: insertedRow.pdf_id })
}