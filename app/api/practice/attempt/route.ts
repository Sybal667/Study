import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  try {
    const { question_id, selected_answer } = (await request.json()) as {
      question_id: number
      selected_answer: string
    }

    if (!question_id || !selected_answer) {
      return NextResponse.json(
        { error: 'question_id and selected_answer are required' },
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

    const { data: questionRow, error: questionErr } = await supabaseAdmin
      .from('pdf_practice_questions')
      .select('correct_answer')
      .eq('question_id', question_id)
      .maybeSingle()

    if (questionErr || !questionRow) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const is_correct = selected_answer === questionRow.correct_answer

const { data: attemptRow, error: upsertErr } = await supabaseAdmin
      .from('pdf_practice_attempts')
      .upsert(
        {
          question_id,
          selected_answer,
          is_correct,
          answered_at: new Date().toISOString(),
        },
        { onConflict: 'question_id' }
      )
      .select('attempt_id, selected_answer, is_correct, answered_at')
      .single()

    if (upsertErr || !attemptRow) {
      console.error('❌ Failed to save attempt:', upsertErr)
      return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 })
    }

    return NextResponse.json({
      attempt: attemptRow,
      correct_answer: questionRow.correct_answer,
    })
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}