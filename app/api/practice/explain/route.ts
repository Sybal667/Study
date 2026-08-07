import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateExplanation, getOrRefreshPracticeFileUri  } from '@/lib/aiProviders/practiceGemini'

export async function POST(request: Request) {
  try {
    const { question_id } = (await request.json()) as { question_id: number }

    if (!question_id) {
      return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      console.error('❌ Supabase Admin client is not initialized')
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }

    const { data: questionRow, error: questionErr } = await supabaseAdmin
      .from('pdf_practice_questions')
      .select('question_text, options, correct_answer, explanation, set_id')
      .eq('question_id', question_id)
      .maybeSingle()

    if (questionErr || !questionRow) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    if (questionRow.explanation) {
      return NextResponse.json({ explanation: questionRow.explanation })
    }

    const { data: setRow, error: setErr } = await supabaseAdmin
      .from('pdf_practice_sets')
      .select('pdf_id')
      .eq('set_id', questionRow.set_id)
      .maybeSingle()

    if (setErr || !setRow) {
      return NextResponse.json({ error: 'Practice set not found' }, { status: 404 })
    }

    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url')
      .eq('pdf_id', setRow.pdf_id)
      .maybeSingle()

    if (pdfErr || !pdfRow) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    let explanation: string
    try {
      explanation = await generateExplanation({
        geminiFileUri: pdfRow.file_url,
        questionText: questionRow.question_text,
        options: questionRow.options as string[],
        correctAnswer: questionRow.correct_answer,
      })
    } catch (err) {
      console.error('❌ Explanation generation failed:', err)

      if (err instanceof Error && err.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: 'Daily AI limit reached — try again tomorrow.' },
          { status: 429 }
        )
      }

      return NextResponse.json({ error: 'AI request failed, please try again' }, { status: 502 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('pdf_practice_questions')
      .update({ explanation })
      .eq('question_id', question_id)

    if (updateErr) {
      console.error('❌ Failed to save explanation:', updateErr)
    }

    return NextResponse.json({ explanation })
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}