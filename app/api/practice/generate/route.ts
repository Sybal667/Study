import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateMcqSet,getOrRefreshPracticeFileUri, PRACTICE_MODEL } from '@/lib/aiProviders/practiceGemini'

export async function POST(request: Request) {
  try {
    const { pdf_id, bucket_start_page, bucket_end_page } = (await request.json()) as {
      pdf_id: number
      bucket_start_page: number
      bucket_end_page: number
    }

    if (!pdf_id || !bucket_start_page || !bucket_end_page) {
      return NextResponse.json(
        { error: 'pdf_id, bucket_start_page and bucket_end_page are required' },
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

    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url')
      .eq('pdf_id', pdf_id)
      .maybeSingle()

    if (pdfErr || !pdfRow) {
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

      return NextResponse.json({ error: 'AI request failed, please try again' }, { status: 502 })
    }

    if (!questions.length) {
      return NextResponse.json({ error: 'No questions were generated' }, { status: 502 })
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
      return NextResponse.json({ error: 'Failed to save practice set' }, { status: 500 })
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
      .select('question_id, question_text, options, correct_answer, explanation, created_at')

    if (questionsErr || !questionRows) {
      console.error('❌ Failed to save practice questions:', questionsErr)
      return NextResponse.json({ error: 'Failed to save practice questions' }, { status: 500 })
    }

    return NextResponse.json({
      ...setRow,
      pdf_practice_questions: questionRows.map((q) => ({ ...q, pdf_practice_attempts: [] })),
    })
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}