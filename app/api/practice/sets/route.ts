import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPracticeBucket } from '@/lib/practiceUtils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pdfId = Number(searchParams.get('pdf_id'))
    const page = Number(searchParams.get('page'))
    const totalPages = Number(searchParams.get('total_pages'))

    if (!pdfId || !page || !totalPages) {
      return NextResponse.json(
        { error: 'pdf_id, page and total_pages are required' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      console.error('❌ Supabase Admin client is not initialized')
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }

    const { bucket_start_page, bucket_end_page } = getPracticeBucket(page, totalPages)

    const { data: sets, error: setsErr } = await supabaseAdmin
      .from('pdf_practice_sets')
      .select(
        `
        set_id,
        pdf_id,
        bucket_start_page,
        bucket_end_page,
        model,
        created_at,
        pdf_practice_questions (
          question_id,
          question_text,
          options,
          correct_answer,
          explanation,
          created_at,
          pdf_practice_attempts (
            attempt_id,
            selected_answer,
            is_correct,
            answered_at
          )
        )
      `
      )
      .eq('pdf_id', pdfId)
      .eq('bucket_start_page', bucket_start_page)
      .eq('bucket_end_page', bucket_end_page)
      .order('created_at', { ascending: false })

    if (setsErr) {
      console.error('❌ Fetch practice sets error:', setsErr)
      return NextResponse.json({ error: setsErr.message }, { status: 500 })
    }

    return NextResponse.json({
      bucket_start_page,
      bucket_end_page,
      sets: sets ?? [],
    })
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}