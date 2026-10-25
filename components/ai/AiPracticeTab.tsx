'use client'

import { useState } from 'react'
import { navButtonStyle } from '@/lib/studyStyles'
import { usePractice, type PracticeSet } from '@/hooks/usePractice'

interface AiPracticeTabProps {
  pdfId: number | null
  currentPage: number
  totalPages: number
}

export default function AiPracticeTab({ pdfId, currentPage, totalPages }: AiPracticeTabProps) {
  const { bucket, sets, loading, generating, error, generateSet, submitAnswer, getExplanation } = usePractice(
    pdfId,
    currentPage,
    totalPages
  )
  const [activeSet, setActiveSet] = useState<PracticeSet | null>(null)

  if (!pdfId) {
    return (
      <div style={{ fontSize: '13px', opacity: 0.6, color: 'white' }}>
        Open a PDF to start practicing.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ fontSize: '13px', opacity: 0.6, color: 'white' }}>
        Loading practice sets...
      </div>
    )
  }

  if (activeSet) {
    return (
      <PracticeSetView
        set={activeSet}
        onBack={() => setActiveSet(null)}
        submitAnswer={submitAnswer}
        getExplanation={getExplanation}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {bucket && (
        <div style={{ fontSize: '13px', opacity: 0.7, color: 'white' }}>
          Pages {bucket.bucket_start_page}–{bucket.bucket_end_page}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '13px', color: '#ff8080' }}>{error}</div>
      )}

      {sets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', opacity: 0.7, color: 'white' }}>Previous sets</div>
          {sets.map((set) => {
            const answered = set.pdf_practice_questions.filter((q) => q.pdf_practice_attempts.length > 0).length
            const correct = set.pdf_practice_questions.filter((q) => q.pdf_practice_attempts[0]?.is_correct).length

            return (
              <button
                key={set.set_id}
                onClick={() => setActiveSet(set)}
                style={{
                  ...navButtonStyle,
                  textAlign: 'left',
                  padding: '12px',
                  color: 'white',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                  Set from {new Date(set.created_at).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  {answered}/{set.pdf_practice_questions.length} answered
                  {answered > 0 ? ` · ${correct} correct` : ''}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={async () => {
          const newSet = await generateSet()
          if (newSet) setActiveSet(newSet)
        }}
        disabled={generating}
        style={{
          ...navButtonStyle,
          backgroundColor: 'rgba(30, 58, 138, 0.6)',
          borderColor: 'rgba(255,255,255,0.2)',
          fontWeight: 'bold',
          color: 'white',
          opacity: generating ? 0.5 : 1,
          cursor: generating ? 'not-allowed' : 'pointer',
        }}
      >
        {generating ? 'Generating...' : 'Generate new practice set'}
      </button>
    </div>
  )
}

interface PracticeSetViewProps {
  set: PracticeSet
  onBack: () => void
  submitAnswer: (questionId: number, selectedAnswer: string) => Promise<{ attempt: { is_correct: boolean }; correct_answer: string } | null>
  getExplanation: (questionId: number) => Promise<string | null>
}

function PracticeSetView({ set, onBack, submitAnswer, getExplanation }: PracticeSetViewProps) {
  const [loadingIds, setLoadingIds] = useState<number[]>([])
  // Answers the student has picked but not submitted yet.
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const questions = set.pdf_practice_questions
  const unanswered = questions.filter((q) => q.pdf_practice_attempts.length === 0)
  const pickedCount = unanswered.filter((q) => selections[q.question_id]).length
  const canSubmit = unanswered.length > 0 && pickedCount === unanswered.length && !submitting
  const allSubmitted = questions.length > 0 && unanswered.length === 0
  const score = questions.filter((q) => q.pdf_practice_attempts[0]?.is_correct).length

  const handlePick = (questionId: number, option: string) => {
    setSelections((prev) => ({ ...prev, [questionId]: option }))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)

    try {
      const results = await Promise.all(
        unanswered.map(async (q) => ({
          questionId: q.question_id,
          result: await submitAnswer(q.question_id, selections[q.question_id]),
        }))
      )

      // Same as before: wrong answers get their explanation loaded automatically.
      const wrongIds = results
        .filter((r) => r.result && !r.result.attempt.is_correct)
        .map((r) => r.questionId)

      setSelections({})
      setSubmitting(false)

      if (wrongIds.length > 0) {
        setLoadingIds(wrongIds)
        for (const id of wrongIds) {
          await getExplanation(id)
          setLoadingIds((prev) => prev.filter((x) => x !== id))
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleReveal = async (questionId: number) => {
    setLoadingIds((prev) => [...prev, questionId])
    await getExplanation(questionId)
    setLoadingIds((prev) => prev.filter((x) => x !== questionId))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{`
        .practice-option:hover {
          background-color: rgba(255, 255, 255, 0.16) !important;
          border-color: rgba(255, 255, 255, 0.55) !important;
        }
      `}</style>

      <button onClick={onBack} style={{ ...navButtonStyle, alignSelf: 'flex-start', color: 'white' }}>
        ← Back
      </button>

      {allSubmitted && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: score === questions.length ? 'rgba(76, 175, 80, 0.2)' : 'rgba(30, 58, 138, 0.35)',
            border: `1px solid ${score === questions.length ? 'rgba(76, 175, 80, 0.6)' : 'rgba(255,255,255,0.2)'}`,
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          You got {score} / {questions.length} correct
        </div>
      )}

      {questions.map((q, i) => {
        const attempt = q.pdf_practice_attempts[0]
        const hasAnswered = !!attempt
        const chosen = hasAnswered ? attempt.selected_answer : selections[q.question_id]

        return (
          <div
            key={q.question_id}
            style={{
              padding: '14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' }}>
              {i + 1}. {q.question_text}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {q.options.map((option) => {
                const isChosen = chosen === option
                const isCorrectOption = option === q.correct_answer

                let backgroundColor = 'rgba(255,255,255,0.06)'
                let borderColor = 'rgba(255,255,255,0.15)'
                let opacity = 1
                let tag = ''

                if (!hasAnswered) {
                  // still answering: show which option is picked
                  if (isChosen) {
                    backgroundColor = 'rgba(30, 58, 138, 0.75)'
                    borderColor = 'rgba(130, 170, 255, 0.9)'
                    tag = 'Selected'
                  }
                } else if (isCorrectOption) {
                  // submitted: the right answer is always green
                  backgroundColor = 'rgba(76, 175, 80, 0.3)'
                  borderColor = '#4CAF50'
                  tag = isChosen ? '✓ Your answer' : '✓ Correct answer'
                } else if (isChosen) {
                  // submitted: a wrong pick is red
                  backgroundColor = 'rgba(255, 107, 107, 0.3)'
                  borderColor = '#ff6b6b'
                  tag = '✗ Your answer'
                } else {
                  opacity = 0.55
                }

                const locked = hasAnswered || submitting

                return (
                  <button
                    key={option}
                    className={locked ? undefined : 'practice-option'}
                    onClick={() => !locked && handlePick(q.question_id, option)}
                    disabled={locked}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${borderColor}`,
                      backgroundColor,
                      color: 'white',
                      fontSize: '13px',
                      opacity,
                      cursor: locked ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    <span>{option}</span>
                    {tag && (
                      <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', opacity: 0.9 }}>
                        {tag}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {hasAnswered && (
              <div style={{ marginTop: '10px' }}>
                {!q.explanation && loadingIds.includes(q.question_id) && (
                  <div style={{ fontSize: '12px', opacity: 0.6, fontStyle: 'italic' }}>Loading explanation...</div>
                )}

                {!q.explanation && !loadingIds.includes(q.question_id) && (
                  <button
                    onClick={() => handleReveal(q.question_id)}
                    style={{ ...navButtonStyle, fontSize: '12px', padding: '6px 10px', color: 'white' }}
                  >
                    Show explanation
                  </button>
                )}

                {q.explanation && (
                  <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '6px', lineHeight: 1.5 }}>
                    {q.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {!allSubmitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.28)',
              backgroundColor: 'rgba(30, 58, 138, 0.95)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.45,
              transition: 'opacity 0.15s ease',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit answers'}
          </button>
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'white', opacity: 0.6 }}>
            {pickedCount} of {unanswered.length} answered
            {pickedCount < unanswered.length ? ' · answer every question to submit' : ''}
          </div>
        </div>
      )}
    </div>
  )
}