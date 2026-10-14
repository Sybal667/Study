import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPracticeBucket } from '@/lib/practiceUtils'

export async function GET(request: Request) {
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
      console.error('❌ Supabase Admin client is not initialized')
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
    }

    const { data: student, error: studentErr } = await supabaseAdmin
      .from('students')
      .select('student_number')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (studentErr || !student) {
      console.error('❌ Failed to resolve authenticated student:', studentErr)
      return NextResponse.json({ error: 'Student account not found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pdfId = Number(searchParams.get('pdf_id'))
    const page = Number(searchParams.get('page'))
    const totalPages = Number(searchParams.get('total_pages'))

    if (
      !Number.isSafeInteger(pdfId) ||
      pdfId <= 0 ||
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(totalPages) ||
      page < 1 ||
      totalPages < 1 ||
      page > totalPages
    ) {
      return NextResponse.json(
        { error: 'Valid pdf_id, page and total_pages are required' },
        { status: 400 }
      )
    }

    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('pdf_id')
      .eq('pdf_id', pdfId)
      .eq('student_number', student.student_number)
      .maybeSingle()

    if (pdfErr) {
      console.error('❌ Failed to verify PDF ownership:', pdfErr)
      return NextResponse.json({ error: 'Failed to verify PDF ownership' }, { status: 500 })
    }

    if (!pdfRow) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const { bucket_start_page, bucket_end_page } = getPracticeBucket(page, totalPages)

    const { data: batches, error: batchesErr } = await supabaseAdmin
      .from('pdf_video_batches')
      .select(`
        batch_id,
        pdf_id,
        bucket_start_page,
        bucket_end_page,
        model,
        created_at,
        pdf_video_recommendations (
          video_id,
          title,
          channel_title,
          thumbnail_url,
          description,
          duration_seconds,
          match_percent,
          keyword_percent,
          semantic_percent,
          best_start_seconds,
          best_end_seconds,
          topic
        )
      `)
      .eq('pdf_id', pdfId)
      .eq('bucket_start_page', bucket_start_page)
      .eq('bucket_end_page', bucket_end_page)
      .order('created_at', { ascending: false })

    if (batchesErr) {
      console.error('❌ Fetch video batches error:', batchesErr)
      return NextResponse.json({ error: 'Failed to fetch video batches' }, { status: 500 })
    }

    return NextResponse.json(
      {
        bucket_start_page,
        bucket_end_page,
        batches: batches ?? [],
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
