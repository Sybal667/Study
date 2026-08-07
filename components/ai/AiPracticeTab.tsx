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
  const [loadingExplanation, setLoadingExplanation] = useState<number | null>(null)

  const handleSelect = async (questionId: number, option: string) => {
    const result = await submitAnswer(questionId, option)
    if (result && !result.attempt.is_correct) {
      setLoadingExplanation(questionId)
      await getExplanation(questionId)
      setLoadingExplanation(null)
    }
  }

  const handleReveal = async (questionId: number) => {
    setLoadingExplanation(questionId)
    await getExplanation(questionId)
    setLoadingExplanation(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button onClick={onBack} style={{ ...navButtonStyle, alignSelf: 'flex-start', color: 'white' }}>
        ← Back
      </button>

      {set.pdf_practice_questions.map((q, i) => {
        const attempt = q.pdf_practice_attempts[0]
        const hasAnswered = !!attempt

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
                const isSelected = attempt?.selected_answer === option
                const isCorrectOption = option === q.correct_answer

                let backgroundColor = 'rgba(255,255,255,0.06)'
                if (hasAnswered && isCorrectOption) backgroundColor = 'rgba(76, 175, 80, 0.3)'
                else if (hasAnswered && isSelected && !isCorrectOption) backgroundColor = 'rgba(255, 107, 107, 0.3)'

                return (
                  <button
                    key={option}
                    onClick={() => !hasAnswered && handleSelect(q.question_id, option)}
                    disabled={hasAnswered}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      backgroundColor,
                      color: 'white',
                      fontSize: '13px',
                      cursor: hasAnswered ? 'default' : 'pointer',
                    }}
                  >
                    {option}
                  </button>
                )
              })}
            </div>

            {hasAnswered && (
              <div style={{ marginTop: '10px' }}>
                {!q.explanation && loadingExplanation === q.question_id && (
                  <div style={{ fontSize: '12px', opacity: 0.6, fontStyle: 'italic' }}>Loading explanation...</div>
                )}

                {!q.explanation && loadingExplanation !== q.question_id && (
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
    </div>
  )
}