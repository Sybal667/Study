
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

    let body: { pdf_id?: unknown }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      )
    }
const pdfId = body.pdf_id

if (typeof pdfId !== 'number' || !Number.isSafeInteger(pdfId) || pdfId <= 0) {
      return NextResponse.json(
        { error: 'Invalid pdf_id' },
        { status: 400 },
      )
    }

    const { data: pdfRow, error: fetchError } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url, student_number')
      .eq('pdf_id', pdfId)
      .eq('student_number', student.student_number)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed to retrieve PDF record:', fetchError)
      return NextResponse.json(
        { error: 'Failed to retrieve document' },
        { status: 500 },
      )
    }

    if (!pdfRow) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      )
    }

    let storagePath: string | null = null

    try {
      const fileUrl = new URL(pdfRow.file_url)
      const expectedPrefix = '/storage/v1/object/public/pdfs/'

      if (
        fileUrl.protocol === 'https:' &&
        fileUrl.pathname.includes(expectedPrefix)
      ) {
        const encodedPath = fileUrl.pathname.slice(
          fileUrl.pathname.indexOf(expectedPrefix) +
            expectedPrefix.length,
        )

        const decodedPath = decodeURIComponent(encodedPath)

        const expectedFolder = `students/${student.student_number}/`

        if (decodedPath.startsWith(expectedFolder)) {
          storagePath = decodedPath
        }
      }
    } catch {
    }

    const { data: deletedRows, error: deleteError } = await supabaseAdmin
      .from('student_pdfs')
      .delete()
      .eq('pdf_id', pdfId)
      .eq('student_number', student.student_number)
      .select('pdf_id')

    if (deleteError) {
      console.error('Failed to delete PDF record:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 },
      )
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      )
    }

    if (storagePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('pdfs')
        .remove([storagePath])

      if (storageError) {
        console.error(
          'PDF record deleted, but storage cleanup failed:',
          storageError,
        )

        return NextResponse.json({
          success: true,
          storage_cleanup_pending: true,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PDF deletion route failed:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
