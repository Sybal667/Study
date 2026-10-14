
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

    let body: { question_id?: unknown; selected_answer?: unknown }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const question_id = Number(body.question_id)
    const selected_answer = body.selected_answer

    if (
      !Number.isSafeInteger(question_id) ||
      question_id <= 0 ||
      typeof selected_answer !== 'string' ||
      !selected_answer.trim() ||
      selected_answer.length > 1000
    ) {
      return NextResponse.json(
        { error: 'A valid question_id and selected_answer are required' },
        { status: 400 }
      )
    }

    const { data: questionRow, error: questionErr } = await supabaseAdmin
      .from('pdf_practice_questions')
      .select(`
        correct_answer,
        pdf_practice_sets (
          pdf_id,
          student_pdfs (
            student_number
          )
        )
      `)
      .eq('question_id', question_id)
      .maybeSingle()

    if (questionErr || !questionRow) {
      console.error('❌ Failed to fetch practice question:', questionErr)
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const practiceSet = Array.isArray(questionRow.pdf_practice_sets)
      ? questionRow.pdf_practice_sets[0]
      : questionRow.pdf_practice_sets

    const pdf = practiceSet
      ? Array.isArray(practiceSet.student_pdfs)
        ? practiceSet.student_pdfs[0]
        : practiceSet.student_pdfs
      : null

    if (!pdf || pdf.student_number !== student.student_number) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const is_correct = selected_answer === questionRow.correct_answer

    const { data: attemptRow, error: attemptErr } = await supabaseAdmin
      .from('pdf_practice_attempts')
      .insert({
        question_id,
        student_number: student.student_number,
        selected_answer: selected_answer.trim(),
        is_correct,
        answered_at: new Date().toISOString(),
      })
      .select('attempt_id, question_id, selected_answer, is_correct, answered_at')
      .single()

    if (attemptErr || !attemptRow) {
      console.error('❌ Failed to save attempt:', attemptErr)
      return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 })
    }

    return NextResponse.json(
      {
        attempt: attemptRow,
        correct_answer: questionRow.correct_answer,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
