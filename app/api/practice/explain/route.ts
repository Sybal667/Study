
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateExplanation } from '@/lib/aiProviders/practiceGemini'

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

    let body: { question_id?: unknown }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const question_id = Number(body.question_id)

    if (!Number.isSafeInteger(question_id) || question_id <= 0) {
      return NextResponse.json(
        { error: 'A valid question_id is required' },
        { status: 400 }
      )
    }

    const { data: questionRow, error: questionErr } = await supabaseAdmin
      .from('pdf_practice_questions')
      .select('question_text, options, correct_answer, explanation, set_id')
      .eq('question_id', question_id)
      .maybeSingle()

    if (questionErr || !questionRow) {
      console.error('❌ Failed to fetch practice question:', questionErr)
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const { data: setRow, error: setErr } = await supabaseAdmin
      .from('pdf_practice_sets')
      .select('pdf_id')
      .eq('set_id', questionRow.set_id)
      .maybeSingle()

    if (setErr || !setRow) {
      console.error('❌ Failed to fetch practice set:', setErr)
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url')
      .eq('pdf_id', setRow.pdf_id)
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
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const { data: attemptRow, error: attemptErr } = await supabaseAdmin
      .from('pdf_practice_attempts')
      .select('attempt_id')
      .eq('question_id', question_id)
      .eq('student_number', student.student_number)
      .limit(1)
      .maybeSingle()

    if (attemptErr) {
      console.error('❌ Failed to verify practice attempt:', attemptErr)
      return NextResponse.json(
        { error: 'Failed to verify practice attempt' },
        { status: 500 }
      )
    }

    if (!attemptRow) {
      return NextResponse.json(
        { error: 'Submit an answer before requesting an explanation' },
        { status: 403 }
      )
    }

    if (questionRow.explanation?.trim()) {
      return NextResponse.json(
        { explanation: questionRow.explanation },
        { headers: { 'Cache-Control': 'private, no-store' } }
      )
    }

    let explanation: string

    try {
      explanation = await generateExplanation({
        geminiFileUri: pdfRow.file_url,
        questionText: questionRow.question_text,
        options: questionRow.options as string[],
        correctAnswer: questionRow.correct_answer,
      })

      if (typeof explanation !== 'string' || !explanation.trim()) {
        console.error('❌ Explanation generation returned an empty result')
        return NextResponse.json(
          { error: 'Failed to generate explanation' },
          { status: 502 }
        )
      }
    } catch (err) {
      console.error('❌ Explanation generation failed:', err)

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

    const cleanedExplanation = explanation.trim()

    const { data: updatedQuestion, error: updateErr } = await supabaseAdmin
      .from('pdf_practice_questions')
      .update({ explanation: cleanedExplanation })
      .eq('question_id', question_id)
      .eq('set_id', questionRow.set_id)
      .select('question_id')
      .maybeSingle()

    if (updateErr || !updatedQuestion) {
      console.error('❌ Failed to save explanation:', updateErr)
      return NextResponse.json(
        { error: 'Failed to save explanation' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { explanation: cleanedExplanation },
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
