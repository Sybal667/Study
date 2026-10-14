
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getValidDriveAccessToken } from '@/lib/googleDrive'

export async function POST(request: NextRequest) {
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

    let body: {
      module_id?: unknown
      file_id?: unknown
      file_name?: unknown
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      )
    }

    const { module_id, file_id } = body

    const moduleId = Number(module_id)

    if (
      !Number.isSafeInteger(moduleId) ||
      moduleId <= 0 ||
      typeof file_id !== 'string' ||
      !/^[a-zA-Z0-9_-]{10,200}$/.test(file_id)
    ) {
      return NextResponse.json(
        { error: 'Invalid module_id or file_id' },
        { status: 400 },
      )
    }

    const { data: module, error: moduleError } = await supabaseAdmin
      .from('modules')
      .select('module_id')
      .eq('module_id', moduleId)
      .maybeSingle()

    if (moduleError) {
      console.error('Failed to verify module:', moduleError)
      return NextResponse.json(
        { error: 'Failed to verify module' },
        { status: 500 },
      )
    }

    if (!module) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 },
      )
    }

    const accessToken = await getValidDriveAccessToken(
      student.student_number,
    )

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No valid Drive access for this student' },
        { status: 401 },
      )
    }

    // Verify the Drive file belongs to the student's connected Drive
    // and that Google identifies it as a PDF.
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file_id)}?fields=id,name,mimeType,size,trashed`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      },
    )

    if (!metadataResponse.ok) {
      return NextResponse.json(
        { error: 'Unable to access the selected Drive file' },
        { status: 400 },
      )
    }

    const metadata = await metadataResponse.json()

    if (
      metadata.id !== file_id ||
      metadata.mimeType !== 'application/pdf' ||
      metadata.trashed === true
    ) {
      return NextResponse.json(
        { error: 'The selected Drive file is not a valid PDF' },
        { status: 400 },
      )
    }

    const maxFileSize = 25 * 1024 * 1024

    if (
      metadata.size !== undefined &&
      Number(metadata.size) > maxFileSize
    ) {
      return NextResponse.json(
        { error: 'PDF exceeds the 25 MB import limit' },
        { status: 413 },
      )
    }

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file_id)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      },
    )

    if (!driveResponse.ok) {
      console.error(
        'Drive download failed with status:',
        driveResponse.status,
      )
      return NextResponse.json(
        { error: 'Failed to download PDF from Drive' },
        { status: 502 },
      )
    }

    const fileBuffer = await driveResponse.arrayBuffer()

    if (fileBuffer.byteLength > maxFileSize) {
      return NextResponse.json(
        { error: 'PDF exceeds the 25 MB import limit' },
        { status: 413 },
      )
    }

    const safeFileName = String(metadata.name || 'document.pdf')
      .replace(/[\/\\]/g, '_')
      .replace(/[\u0000-\u001f\u007f]/g, '_')
      .slice(0, 180)

    const storageFileName =
      `students/${student.student_number}/${crypto.randomUUID()}.pdf`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('pdfs')
      .upload(storageFileName, Buffer.from(fileBuffer), {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload failed:', uploadError)
      return NextResponse.json(
        { error: 'Failed to save PDF' },
        { status: 500 },
      )
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('pdfs')
      .getPublicUrl(storageFileName)

    const { data: insertedRow, error: dbError } = await supabaseAdmin
      .from('student_pdfs')
      .insert({
        student_number: student.student_number,
        module_id: moduleId,
        file_name: safeFileName,
        file_url: publicUrlData.publicUrl,
      })
      .select('pdf_id')
      .single()

    if (dbError || !insertedRow) {
      console.error('Failed to save PDF record:', dbError)

      const { error: cleanupError } = await supabaseAdmin.storage
        .from('pdfs')
        .remove([storageFileName])

      if (cleanupError) {
        console.error('Failed to clean up uploaded PDF:', cleanupError)
      }

      return NextResponse.json(
        { error: 'Failed to save PDF record' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        file_url: publicUrlData.publicUrl,
        pdf_id: insertedRow.pdf_id,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (error) {
    console.error('Drive import route failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
