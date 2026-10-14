
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
      return NextResponse.json(
        { error: 'Failed to verify PDF ownership' },
        { status: 500 }
      )
    }

    if (!pdfRow) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const { bucket_start_page, bucket_end_page } = getPracticeBucket(
      page,
      totalPages
    )

    const { data: sets, error: setsErr } = await supabaseAdmin
      .from('pdf_practice_sets')
      .select(`
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
          created_at
        )
      `)
      .eq('pdf_id', pdfId)
      .eq('bucket_start_page', bucket_start_page)
      .eq('bucket_end_page', bucket_end_page)
      .order('created_at', { ascending: false })

    if (setsErr) {
      console.error('❌ Fetch practice sets error:', setsErr)
      return NextResponse.json(
        { error: 'Failed to fetch practice sets' },
        { status: 500 }
      )
    }

    const questionIds = (sets ?? []).flatMap((set) =>
      (set.pdf_practice_questions ?? []).map((question) => question.question_id)
    )

    let attemptsByQuestion = new Map<number, {
      attempt_id: number
      selected_answer: string
      is_correct: boolean
      answered_at: string | null
    }[]>()

    if (questionIds.length > 0) {
      const { data: attempts, error: attemptsErr } = await supabaseAdmin
        .from('pdf_practice_attempts')
        .select('attempt_id, question_id, selected_answer, is_correct, answered_at')
        .eq('student_number', student.student_number)
        .in('question_id', questionIds)
        .order('answered_at', { ascending: true })

      if (attemptsErr) {
        console.error('❌ Fetch practice attempts error:', attemptsErr)
        return NextResponse.json(
          { error: 'Failed to fetch practice attempts' },
          { status: 500 }
        )
      }

      attemptsByQuestion = new Map()

      for (const attempt of attempts ?? []) {
        const questionAttempts = attemptsByQuestion.get(attempt.question_id) ?? []
        questionAttempts.push({
          attempt_id: attempt.attempt_id,
          selected_answer: attempt.selected_answer,
          is_correct: attempt.is_correct,
          answered_at: attempt.answered_at,
        })
        attemptsByQuestion.set(attempt.question_id, questionAttempts)
      }
    }

    const safeSets = (sets ?? []).map((set) => ({
      ...set,
      pdf_practice_questions: (set.pdf_practice_questions ?? []).map(
        (question) => {
          const attempts = attemptsByQuestion.get(question.question_id) ?? []
          const hasAttempt = attempts.length > 0

          return {
            ...question,
            correct_answer: hasAttempt ? question.correct_answer : null,
            explanation: hasAttempt ? question.explanation : null,
            pdf_practice_attempts: attempts,
          }
        }
      ),
    }))

    return NextResponse.json(
      {
        bucket_start_page,
        bucket_end_page,
        sets: safeSets,
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
