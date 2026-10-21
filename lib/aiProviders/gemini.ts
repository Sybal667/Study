import { toPlainTextStream } from './sseStream'

export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files'

export interface GeminiFileRef {
  file_uri: string
  expires_at: string
}

export async function uploadFileToGemini(fileUrl: string): Promise<GeminiFileRef> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const fileRes = await fetch(fileUrl)
  if (!fileRes.ok) throw new Error(`Failed to download PDF for upload: ${fileRes.status}`)
  const fileBytes = new Uint8Array(await fileRes.arrayBuffer())
  const boundary = `gemini-upload-${Date.now()}`
  const metadata = JSON.stringify({ file: { display_name: `pdf-${Date.now()}` } })
  const bodyParts: Uint8Array[] = [
    new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    fileBytes,
    new TextEncoder().encode(`\r\n--${boundary}--`),
  ]
  const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0)
  const body = new Uint8Array(totalLength)
  let offset = 0
  for (const part of bodyParts) {
    body.set(part, offset)
    offset += part.length
  }

  const res = await fetch(`${GEMINI_UPLOAD_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'X-Goog-Upload-Protocol': 'multipart',
    },
    body,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini file upload failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const uri: string | undefined = data?.file?.uri
  const expirationTime: string | undefined = data?.file?.expirationTime
  if (!uri || !expirationTime) throw new Error('Gemini upload response missing file uri/expiration')
  return { file_uri: uri, expires_at: expirationTime }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type GeminiModel = 'gemini-3.5-flash' | 'gemini-3.1-pro-preview'

export const GEMINI_MODELS: { id: GeminiModel; label: string; description: string }[] = [
  { id: 'gemini-3.5-flash', label: 'Flash', description: 'Fast, great for most questions' },
  { id: 'gemini-3.1-pro-preview', label: 'Pro', description: 'Deepest reasoning — best for dense diagrams & long documents' },
]

const CHAT_SYSTEM_INSTRUCTION = `You are a study assistant helping a student with the attached document. The student can see the document themselves — you are here to answer their specific questions about it, not to work through it unprompted.

Wait for the student to ask something. Do not summarize, solve, or explain the whole document, an entire section, or every question in it unless the student explicitly asks you to. If the student sends a short or vague greeting (like "hi"), respond conversationally and ask what they'd like help with — do not treat it as a request to begin solving the document.

When the student does ask about a specific part, answer that part only, using the document for reference. If the student includes a screenshot, analyze the screenshot as part of their current question.`

interface SendMessageParams {
  geminiFileUri: string
  history: ChatMessage[]
  newMessage: string
  model: GeminiModel
  imageData?: string | null
}

function buildContents(
  geminiFileUri: string,
  history: ChatMessage[],
  newMessage: string,
  imageData?: string | null,
) {
  const contents: Array<{
    role: 'user' | 'model'
    parts: Array<Record<string, unknown>>
  }> = []

  let imagePart: Record<string, unknown> | null = null
  if (imageData) {
    const match = imageData.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
    if (!match) throw new Error('Invalid screenshot image data')
    imagePart = { inline_data: { mime_type: match[1], data: match[2] } }
  }

  history.forEach((msg, i) => {
    const role = msg.role === 'assistant' ? 'model' : 'user'
    if (i === 0 && msg.role === 'user') {
      contents.push({
        role,
        parts: [
          { file_data: { file_uri: geminiFileUri, mime_type: 'application/pdf' } },
          { text: msg.content },
        ],
      })
    } else {
      contents.push({ role, parts: [{ text: msg.content }] })
    }
  })

  const latestParts: Array<Record<string, unknown>> = []
  if (imagePart) latestParts.push(imagePart)
  latestParts.push({ text: newMessage })

  if (history.length === 0) {
    contents.push({
      role: 'user',
      parts: [
        { file_data: { file_uri: geminiFileUri, mime_type: 'application/pdf' } },
        ...latestParts,
      ],
    })
  } else {
    contents.push({ role: 'user', parts: latestParts })
  }

  return contents
}

export async function sendMessage({ geminiFileUri, history, newMessage, model, imageData }: SendMessageParams): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const contents = buildContents(geminiFileUri, history, newMessage, imageData)
  const maxAttempts = 3
  const timeoutMs = 30000
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, system_instruction: { parts: [{ text: CHAT_SYSTEM_INSTRUCTION }] } }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        const errText = await res.text()
        if (res.status === 429) throw new Error('QUOTA_EXCEEDED')
        if (res.status === 503 && attempt < maxAttempts) {
          lastError = new Error(`Gemini API error (${res.status}): ${errText}`)
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
          continue
        }
        throw new Error(`Gemini API error (${res.status}): ${errText}`)
      }

      const data = await res.json()
      const replyText: string = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? ''
      if (!replyText) throw new Error('Gemini returned an empty response')
      return replyText
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Gemini request timed out after ${timeoutMs / 1000}s`)
        if (attempt < maxAttempts) continue
        throw lastError
      }
      throw err
    }
  }

  throw lastError ?? new Error('Gemini request failed after retries')
}

export async function streamMessage({ geminiFileUri, history, newMessage, model, imageData }: SendMessageParams): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const contents = buildContents(geminiFileUri, history, newMessage, imageData)

  const res = await fetch(`${GEMINI_API_URL}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, system_instruction: { parts: [{ text: CHAT_SYSTEM_INSTRUCTION }] } }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    if (res.status === 429) throw new Error('QUOTA_EXCEEDED')
    throw new Error(`Gemini API error (${res.status}): ${errText}`)
  }

  return toPlainTextStream(res.body, (chunk) => {
    const data = chunk as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    return data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  })
}


