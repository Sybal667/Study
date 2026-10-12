import { GEMINI_API_URL } from './gemini'
import { PRACTICE_MODEL } from './practiceGemini'

interface GenerateVideoTopicsParams {
  geminiFileUri: string
  bucketStartPage: number
  bucketEndPage: number
}

function extractJsonArray(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')

  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini did not return a JSON array')
  }

  return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export async function generateVideoTopics({
  geminiFileUri,
  bucketStartPage,
  bucketEndPage,
}: GenerateVideoTopicsParams): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const prompt = `You are helping a student find YouTube videos that explain the content on pages ${bucketStartPage} to ${bucketEndPage} of the attached PDF.

Identify the 2 to 3 main concepts or topics covered on those pages. For each one, write a short, specific YouTube search query (4-8 words) that would surface a good explainer video on that exact concept. Use plain topic language a teacher would search, not quotes from the document.

Respond with ONLY a raw JSON array of strings, no markdown fences, no extra text, in this exact shape:
["search query 1", "search query 2"]`

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

        if (res.status === 503) {
          throw new Error('MODEL_OVERLOADED')
        }

        throw new Error(`Gemini API error (${res.status}): ${errText}`)
      }

      const data = await res.json()
      const replyText: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

      if (!replyText) {
        throw new Error('Gemini returned an empty response')
      }

      const topics = extractJsonArray(replyText)

      if (!topics.length) {
        throw new Error('Gemini returned no usable topics')
      }

      return topics
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

  throw lastError ?? new Error('Gemini video topic generation failed after retries')
}
