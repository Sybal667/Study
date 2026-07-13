import { streamMessage as geminiStreamMessage, type ChatMessage, type GeminiModel } from './gemini'
import { streamMessage as groqStreamMessage } from './groq'
import { getPdfText } from '@/lib/pdfText'
import { getModelInfo } from './models'

interface RouterParams {
  pdfId: number
  fileUrl: string
  history: ChatMessage[]
  newMessage: string
  model: string
}

export async function streamMessage({ pdfId, fileUrl, history, newMessage, model }: RouterParams): Promise<ReadableStream<Uint8Array>> {
  const modelInfo = getModelInfo(model)
  if (!modelInfo) {
    throw new Error(`Unknown model: ${model}`)
  }

  if (modelInfo.provider === 'gemini') {
    return geminiStreamMessage({ fileUrl, history, newMessage, model: model as GeminiModel })
  }

if (modelInfo.provider === 'groq') {
    const pdfText = await getPdfText(pdfId, fileUrl)
    const contextPrefix = `The following is text extracted from a PDF the student is studying. Use it to answer their question.\n\n---\n${pdfText}\n---\n\n`

    return groqStreamMessage({
      fileUrl,
      history,
      newMessage: contextPrefix + newMessage,
      model,
    })
  }

  throw new Error(`Unsupported provider: ${modelInfo.provider}`)
}