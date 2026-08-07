import { GEMINI_API_URL, uploadFileToGemini, type GeminiModel } from './gemini'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const PRACTICE_MODEL: GeminiModel = 'gemini-3.1-pro-preview'

export async function getOrRefreshPracticeFileUri(pdfId: number, fileUrl: string): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client is not initialized')
  }

  const { data: pdfRow, error } = await supabaseAdmin
    .from('student_pdfs')
    .select('gemini_practice_file_uri, gemini_practice_file_expires_at')
    .eq('pdf_id', pdfId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check Gemini file cache: ${error.message}`)
  }

  const now = new Date()
  const expiresAt = pdfRow?.gemini_practice_file_expires_at ? new Date(pdfRow.gemini_practice_file_expires_at) : null

  if (pdfRow?.gemini_practice_file_uri && expiresAt && expiresAt > now) {
    return pdfRow.gemini_practice_file_uri
  }

  const { file_uri, expires_at } = await uploadFileToGemini(fileUrl)

  const { error: updateErr } = await supabaseAdmin
    .from('student_pdfs')
    .update({ gemini_practice_file_uri: file_uri, gemini_practice_file_expires_at: expires_at })
    .eq('pdf_id', pdfId)

  if (updateErr) {
    console.error('❌ Failed to save Gemini practice file uri:', updateErr)
  }

  return file_uri
}

export interface McqQuestion {
  question_text: string
  options: string[]
  correct_answer: string
}

interface GenerateMcqParams {
  geminiFileUri: string
  bucketStartPage: number
  bucketEndPage: number
}

function extractJsonArray(raw: string): McqQuestion[] {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini did not return a JSON array')
  }

  return parsed as McqQuestion[]
}

export async function generateMcqSet({ geminiFileUri, bucketStartPage, bucketEndPage }: GenerateMcqParams): Promise<McqQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const prompt = `You are creating a practice quiz for a student studying this document.

Write exactly 10 multiple-choice questions based ONLY on the content found on pages ${bucketStartPage} to ${bucketEndPage} of the attached PDF. Do not ask about content from other pages.

Each question must have exactly 4 options, with exactly one correct answer.

Respond with ONLY a raw JSON array, no markdown fences, no extra text, in this exact shape:
[
  {
    "question_text": "string",
    "options": ["string", "string", "string", "string"],
    "correct_answer": "string (must exactly match one of the options)"
  }
]`

  const contents = [
    {
      role: 'user',
      parts: [
        { file_data: { file_uri: geminiFileUri, mime_type: 'application/pdf' } },
        { text: prompt },
      ],
    },
  ]

  const MAX_ATTEMPTS = 3
  const TIMEOUT_MS = 30_000
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${GEMINI_API_URL}/${PRACTICE_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errText = await res.text()

        if (res.status === 429) {
          throw new Error('QUOTA_EXCEEDED')
        }

        if (res.status === 503 && attempt < MAX_ATTEMPTS) {
          lastError = new Error(`Gemini API error (${res.status}): ${errText}`)
          await new Promise((r) => setTimeout(r, attempt * 1000))
          continue
        }

        throw new Error(`Gemini API error (${res.status}): ${errText}`)
      }

      const data = await res.json()
      const replyText: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

      if (!replyText) {
        throw new Error('Gemini returned an empty response')
      }

      return extractJsonArray(replyText)
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Gemini request timed out after ${TIMEOUT_MS / 1000}s`)
        if (attempt < MAX_ATTEMPTS) continue
        throw lastError
      }

      throw err
    }
  }

  throw lastError ?? new Error('Gemini MCQ generation failed after retries')
}
interface GenerateExplanationParams {
  geminiFileUri: string
  questionText: string
  options: string[]
  correctAnswer: string
}

export async function generateExplanation({
  geminiFileUri,
  questionText,
  options,
  correctAnswer,
}: GenerateExplanationParams): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const prompt = `A student is reviewing a practice question based on this document.

Question: ${questionText}
Options: ${options.join(', ')}
Correct answer: ${correctAnswer}

Explain, in 2-4 sentences, why "${correctAnswer}" is the correct answer, using the content of the attached document. Do not repeat the question. Respond with plain text only, no markdown, no JSON.`

  const contents = [
    {
      role: 'user',
      parts: [
        { file_data: { file_uri: geminiFileUri, mime_type: 'application/pdf' } },
        { text: prompt },
      ],
    },
  ]

  const MAX_ATTEMPTS = 3
  const TIMEOUT_MS = 30_000
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${GEMINI_API_URL}/${PRACTICE_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errText = await res.text()

        if (res.status === 429) {
          throw new Error('QUOTA_EXCEEDED')
        }

        if (res.status === 503 && attempt < MAX_ATTEMPTS) {
          lastError = new Error(`Gemini API error (${res.status}): ${errText}`)
          await new Promise((r) => setTimeout(r, attempt * 1000))
          continue
        }

        throw new Error(`Gemini API error (${res.status}): ${errText}`)
      }

      const data = await res.json()
      const replyText: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

      if (!replyText) {
        throw new Error('Gemini returned an empty response')
      }

      return replyText.trim()
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Gemini request timed out after ${TIMEOUT_MS / 1000}s`)
        if (attempt < MAX_ATTEMPTS) continue
        throw lastError
      }

      throw err
    }
  }

  throw lastError ?? new Error('Gemini explanation generation failed after retries')
}