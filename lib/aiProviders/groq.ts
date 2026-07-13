
import { toPlainTextStream } from './sseStream'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SendMessageParams {
  fileUrl: string
  history: ChatMessage[]
  newMessage: string
  model: string
}

export async function streamMessage({ history, newMessage, model }: SendMessageParams): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set')
  }

  const messages = [
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
    { role: 'user', content: newMessage },
  ]

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  })

if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    if (res.status === 429) {
      throw new Error('QUOTA_EXCEEDED')
    }
    throw new Error(`Groq API error (${res.status}): ${errText}`)
  }

  return toPlainTextStream(res.body, (chunk) => {
    const c = chunk as { choices?: Array<{ delta?: { content?: string } }> }
    return c?.choices?.[0]?.delta?.content ?? ''
  })
}