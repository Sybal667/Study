import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin is not initialized — check SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { pdf_id, student_number } = await request.json()

  if (!pdf_id || !student_number) {
    return NextResponse.json({ error: 'Missing pdf_id or student_number' }, { status: 400 })
  }

  const { data: pdfRow, error: fetchError } = await supabaseAdmin
    .from('student_pdfs')
    .select('file_url, student_number')
    .eq('pdf_id', pdf_id)
    .single()

  if (fetchError || !pdfRow) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (pdfRow.student_number !== parseInt(student_number)) {
    return NextResponse.json({ error: 'Not authorized to delete this document' }, { status: 403 })
  }

  const marker = '/pdfs/'
  const markerIndex = pdfRow.file_url.indexOf(marker)
  const storagePath = markerIndex !== -1 ? pdfRow.file_url.slice(markerIndex + marker.length) : null

  if (storagePath) {
    const { error: storageError } = await supabaseAdmin.storage.from('pdfs').remove([storagePath])
    if (storageError) {
      console.error('Failed to delete file from storage (continuing to clean up DB row):', storageError)
    }
  }

  const { error: deleteError } = await supabaseAdmin.from('student_pdfs').delete().eq('pdf_id', pdf_id)

  if (deleteError) {
    console.error('Failed to delete student_pdfs row:', deleteError)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}