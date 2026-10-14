
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  generateMcqSet,
  PRACTICE_MODEL,
} from '@/lib/aiProviders/practiceGemini'

export async function POST(request: Request) {
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
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }

    const { data: student, error: studentErr } = await supabaseAdmin
      .from('students')
      .select('student_number')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (studentErr || !student) {
      console.error('❌ Failed to resolve authenticated student:', studentErr)
      return NextResponse.json(
        { error: 'Student account not found' },
        { status: 403 }
      )
    }

    let body: {
      pdf_id?: unknown
      bucket_start_page?: unknown
      bucket_end_page?: unknown
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const pdf_id = Number(body.pdf_id)
    const bucket_start_page = Number(body.bucket_start_page)
    const bucket_end_page = Number(body.bucket_end_page)

    if (
      !Number.isSafeInteger(pdf_id) ||
      pdf_id <= 0 ||
      !Number.isSafeInteger(bucket_start_page) ||
      !Number.isSafeInteger(bucket_end_page) ||
      bucket_start_page < 1 ||
      bucket_end_page < bucket_start_page ||
      bucket_end_page - bucket_start_page > 49
    ) {
      return NextResponse.json(
        { error: 'Valid PDF ID and page range are required (maximum 50 pages)' },
        { status: 400 }
      )
    }

    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url')
      .eq('pdf_id', pdf_id)
      .eq('student_number', student.student_number)
      .maybeSingle()

    if (pdfErr) {
      console.error('❌ Failed to verify PDF ownership:', pdfErr)
      return NextResponse.json(
        { error: 'Failed to verify PDF ownership' },
        { status: 500 }
      )
    }

    if (!pdfRow) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    let questions

    try {
      questions = await generateMcqSet({
        geminiFileUri: pdfRow.file_url,
        bucketStartPage: bucket_start_page,
        bucketEndPage: bucket_end_page,
      })
    } catch (err) {
      console.error('❌ MCQ generation failed:', err)

      if (err instanceof Error && err.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: 'Daily AI limit reached — try again tomorrow.' },
          { status: 429 }
        )
      }

      if (err instanceof Error && err.message === 'MODEL_OVERLOADED') {
        return NextResponse.json(
          { error: 'Gemini is under heavy load right now — try again in a minute or two.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: 'AI request failed, please try again' },
        { status: 502 }
      )
    }

    if (!questions.length) {
      return NextResponse.json(
        { error: 'No questions were generated' },
        { status: 502 }
      )
    }

    const { data: setRow, error: setErr } = await supabaseAdmin
      .from('pdf_practice_sets')
      .insert({
        pdf_id,
        bucket_start_page,
        bucket_end_page,
        model: PRACTICE_MODEL,
      })
      .select('set_id, pdf_id, bucket_start_page, bucket_end_page, model, created_at')
      .single()

    if (setErr || !setRow) {
      console.error('❌ Failed to save practice set:', setErr)
      return NextResponse.json(
        { error: 'Failed to save practice set' },
        { status: 500 }
      )
    }

    const { data: questionRows, error: questionsErr } = await supabaseAdmin
      .from('pdf_practice_questions')
      .insert(
        questions.map((q) => ({
          set_id: setRow.set_id,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
        }))
      )
      .select('question_id, question_text, options, created_at')

    if (questionsErr || !questionRows) {
      console.error('❌ Failed to save practice questions:', questionsErr)

      const { error: cleanupErr } = await supabaseAdmin
        .from('pdf_practice_sets')
        .delete()
        .eq('set_id', setRow.set_id)

      if (cleanupErr) {
        console.error('❌ Failed to clean up practice set:', cleanupErr)
      }

      return NextResponse.json(
        { error: 'Failed to save practice questions' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ...setRow,
        pdf_practice_questions: questionRows.map((question) => ({
          ...question,
          explanation: null,
          pdf_practice_attempts: [],
        })),
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
