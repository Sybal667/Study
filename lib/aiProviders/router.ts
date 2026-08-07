import { streamMessage as geminiStreamMessage, uploadFileToGemini, type ChatMessage, type GeminiModel } from './gemini'
import { streamMessage as groqStreamMessage } from './groq'
import { getPdfText } from '@/lib/pdfText'
import { getModelInfo } from './models'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface RouterParams {
  pdfId: number
  fileUrl: string
  history: ChatMessage[]
  newMessage: string
  model: string
}

async function getOrRefreshGeminiFileUri(pdfId: number, fileUrl: string): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client is not initialized')
  }

  const { data: pdfRow, error } = await supabaseAdmin
    .from('student_pdfs')
    .select('gemini_chat_file_uri, gemini_chat_file_expires_at')
    .eq('pdf_id', pdfId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check Gemini file cache: ${error.message}`)
  }

  const now = new Date()
  const expiresAt = pdfRow?.gemini_chat_file_expires_at ? new Date(pdfRow.gemini_chat_file_expires_at) : null

  if (pdfRow?.gemini_chat_file_uri && expiresAt && expiresAt > now) {
    return pdfRow.gemini_chat_file_uri
  }

  const { file_uri, expires_at } = await uploadFileToGemini(fileUrl)

  const { error: updateErr } = await supabaseAdmin
    .from('student_pdfs')
    .update({ gemini_chat_file_uri: file_uri, gemini_chat_file_expires_at: expires_at })
    .eq('pdf_id', pdfId)

  if (updateErr) {
    console.error('❌ Failed to save Gemini file uri:', updateErr)
  }

  return file_uri
}

export async function streamMessage({ pdfId, fileUrl, history, newMessage, model }: RouterParams): Promise<ReadableStream<Uint8Array>> {
  const modelInfo = getModelInfo(model)
  if (!modelInfo) {
    throw new Error(`Unknown model: ${model}`)
  }

  if (modelInfo.provider === 'gemini') {
    const geminiFileUri = await getOrRefreshGeminiFileUri(pdfId, fileUrl)
    return geminiStreamMessage({ geminiFileUri, history, newMessage, model: model as GeminiModel })
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