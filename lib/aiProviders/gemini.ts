import { toPlainTextStream } from './sseStream'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type GeminiModel = 'gemini-3.5-flash' | 'gemini-3.1-pro-preview'

export const GEMINI_MODELS: { id: GeminiModel; label: string; description: string }[] = [
  { id: 'gemini-3.5-flash', label: 'Flash', description: 'Fast, great for most questions' },
  { id: 'gemini-3.1-pro-preview', label: 'Pro', description: 'Deepest reasoning — best for dense diagrams & long documents' },
]

interface SendMessageParams {
  fileUrl: string
  history: ChatMessage[]
  newMessage: string
  model: GeminiModel
}

function buildContents(fileUrl: string, history: ChatMessage[], newMessage: string) {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = []

  history.forEach((msg, i) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'
    if (i === 0 && msg.role === 'user') {
      contents.push({
        role,
        parts: [
          { file_data: { file_uri: fileUrl, mime_type: 'application/pdf' } },
          { text: msg.content },
        ],
      })
    } else {
      contents.push({ role, parts: [{ text: msg.content }] })
    }
  })

  if (history.length === 0) {
    contents.push({
      role: 'user',
      parts: [
        { file_data: { file_uri: fileUrl, mime_type: 'application/pdf' } },
        { text: newMessage },
      ],
    })
  } else {
    contents.push({ role: 'user', parts: [{ text: newMessage }] })
  }

  return contents
}




export async function sendMessage({ fileUrl, history, newMessage, model }: SendMessageParams): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = []

  history.forEach((msg, i) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'
    if (i === 0 && msg.role === 'user') {
      contents.push({
        role,
        parts: [
          { file_data: { file_uri: fileUrl, mime_type: 'application/pdf' } },
          { text: msg.content },
        ],
      })
    } else {
      contents.push({ role, parts: [{ text: msg.content }] })
    }
  })

  if (history.length === 0) {
    contents.push({
      role: 'user',
      parts: [
        { file_data: { file_uri: fileUrl, mime_type: 'application/pdf' } },
        { text: newMessage },
      ],
    })
  } else {
    contents.push({ role: 'user', parts: [{ text: newMessage }] })
  }

const MAX_ATTEMPTS = 3
  const TIMEOUT_MS = 30_000

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
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

      return replyText
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Gemini request timed out after ${TIMEOUT_MS / 1000}s`)
        if (attempt < MAX_ATTEMPTS) {
          continue
        }
        throw lastError
      }

      throw err
    }
  }

  throw lastError ?? new Error('Gemini request failed after retries')
}

export async function streamMessage({ fileUrl, history, newMessage, model }: SendMessageParams): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const contents = buildContents(fileUrl, history, newMessage)

  const res = await fetch(`${GEMINI_API_URL}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  })

if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    if (res.status === 429) {
      throw new Error('QUOTA_EXCEEDED')
    }
    throw new Error(`Gemini API error (${res.status}): ${errText}`)
  }

  return toPlainTextStream(res.body, (chunk) => {
    const c = chunk as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    return c?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  })
}