import { useEffect, useState, useCallback } from 'react'

export interface PracticeAttempt {
  attempt_id: number
  selected_answer: string
  is_correct: boolean
  answered_at: string
}

export interface PracticeQuestion {
  question_id: number
  question_text: string
  options: string[]
  correct_answer: string
  explanation: string | null
  created_at: string
  pdf_practice_attempts: PracticeAttempt[]
}

export interface PracticeSet {
  set_id: number
  pdf_id: number
  bucket_start_page: number
  bucket_end_page: number
  model: string
  created_at: string
  pdf_practice_questions: PracticeQuestion[]
}

export function usePractice(pdfId: number | null, currentPage: number, totalPages: number) {
  const [bucket, setBucket] = useState<{ bucket_start_page: number; bucket_end_page: number } | null>(null)
  const [sets, setSets] = useState<PracticeSet[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSets = useCallback(async () => {
    if (!pdfId || !currentPage || !totalPages) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/practice/sets?pdf_id=${pdfId}&page=${currentPage}&total_pages=${totalPages}`
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to load practice sets')
        return
      }

      setBucket({ bucket_start_page: data.bucket_start_page, bucket_end_page: data.bucket_end_page })
      setSets(data.sets ?? [])
    } catch {
      setError('Failed to load practice sets')
    } finally {
      setLoading(false)
    }
  }, [pdfId, currentPage, totalPages])

  useEffect(() => {
    loadSets()
  }, [loadSets])

  const generateSet = async () => {
    if (!pdfId || !bucket) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/practice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_id: pdfId,
          bucket_start_page: bucket.bucket_start_page,
          bucket_end_page: bucket.bucket_end_page,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to generate practice set')
        return
      }

      setSets((prev) => [data, ...prev])
      return data as PracticeSet
    } catch {
      setError('Failed to generate practice set')
    } finally {
      setGenerating(false)
    }
  }

  const submitAnswer = async (questionId: number, selectedAnswer: string) => {
    const res = await fetch('/api/practice/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, selected_answer: selectedAnswer }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to submit answer')
      return null
    }

    setSets((prev) =>
      prev.map((set) => ({
        ...set,
        pdf_practice_questions: set.pdf_practice_questions.map((q) =>
          q.question_id === questionId
            ? { ...q, pdf_practice_attempts: [data.attempt] }
            : q
        ),
      }))
    )

    return data as { attempt: PracticeAttempt; correct_answer: string }
  }

  const getExplanation = async (questionId: number) => {
    const res = await fetch('/api/practice/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to get explanation')
      return null
    }

    setSets((prev) =>
      prev.map((set) => ({
        ...set,
        pdf_practice_questions: set.pdf_practice_questions.map((q) =>
          q.question_id === questionId ? { ...q, explanation: data.explanation } : q
        ),
      }))
    )

    return data.explanation as string
  }

  return { bucket, sets, loading, generating, error, generateSet, submitAnswer, getExplanation, reload: loadSets }
}