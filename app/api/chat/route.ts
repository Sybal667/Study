import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { streamMessage } from '@/lib/aiProviders/router'
import type { ChatMessage } from '@/lib/aiProviders/gemini'

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_MODELS = ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'openai/gpt-oss-120b']
const MAX_IMAGE_DATA_LENGTH = 4_200_000
const IMAGE_DATA_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('student_number')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (studentError) {
      console.error('Failed to resolve student:', studentError)
      return NextResponse.json({ error: 'Failed to verify student account' }, { status: 500 })
    }

    if (!student) {
      return NextResponse.json({ error: 'Student account not linked' }, { status: 403 })
    }

    let body: {
      pdf_id?: unknown
      message?: unknown
      model?: unknown
      imageData?: unknown
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { pdf_id, message, model, imageData } = body

    if (
      !Number.isSafeInteger(pdf_id) ||
      Number(pdf_id) <= 0 ||
      typeof message !== 'string' ||
      !message.trim() ||
      message.length > 10000 ||
      typeof model !== 'string' ||
      !ALLOWED_MODELS.includes(model)
    ) {
      return NextResponse.json({ error: 'Invalid pdf_id, message or model' }, { status: 400 })
    }

    if (imageData !== undefined && imageData !== null) {
      if (
        typeof imageData !== 'string' ||
        imageData.length > MAX_IMAGE_DATA_LENGTH ||
        !IMAGE_DATA_PATTERN.test(imageData)
      ) {
        return NextResponse.json(
          { error: 'Invalid screenshot. Use a PNG, JPEG, WEBP, or GIF image up to 3 MB.' },
          { status: 400 },
        )
      }

      if (model === 'openai/gpt-oss-120b') {
        return NextResponse.json(
          { error: 'Screenshot analysis is not supported by this model. Switch to Gemini.' },
          { status: 400 },
        )
      }
    }

    const pdfId = Number(pdf_id)
    const { data: pdfRow, error: pdfError } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url')
      .eq('pdf_id', pdfId)
      .eq('student_number', student.student_number)
      .maybeSingle()

    if (pdfError) {
      console.error('Failed to retrieve PDF:', pdfError)
      return NextResponse.json({ error: 'Failed to retrieve PDF' }, { status: 500 })
    }

    if (!pdfRow) return NextResponse.json({ error: 'PDF not found' }, { status: 404 })

    const { data: historyRows, error: historyError } = await supabaseAdmin
      .from('pdf_chat_messages')
      .select('role, content')
      .eq('pdf_id', pdfId)
      .eq('model', model)
      .order('created_at', { ascending: true })

    if (historyError) {
      console.error('Failed to fetch chat history:', historyError)
      return NextResponse.json({ error: 'Failed to retrieve chat history' }, { status: 500 })
    }

    const history: ChatMessage[] = (historyRows ?? []).map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }))

    let aiStream: ReadableStream<Uint8Array>

    try {
      aiStream = await streamMessage({
        pdfId,
        fileUrl: pdfRow.file_url,
        history,
        newMessage: message.trim(),
        model,
        imageData: typeof imageData === 'string' ? imageData : null,
      })
    } catch (error) {
      console.error('AI chat request failed:', error)

      if (error instanceof Error && error.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: 'Daily AI limit reached for this model. Try again later or switch models.' },
          { status: 429 },
        )
      }

      if (error instanceof Error && error.message === 'SCREENSHOT_UNSUPPORTED') {
        return NextResponse.json(
          { error: 'Screenshot analysis is not supported by this model. Switch to Gemini.' },
          { status: 400 },
        )
      }

      return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 502 })
    }

    let fullReply = ''
    const decoder = new TextDecoder()
    const outStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = aiStream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            fullReply += decoder.decode(value, { stream: true })
            controller.enqueue(value)
          }
          fullReply += decoder.decode()
        } catch (error) {
          console.error('Error reading AI stream:', error)
        } finally {
          controller.close()
          if (fullReply) {
            const { error: insertError } = await supabaseAdmin!
              .from('pdf_chat_messages')
              .insert([
                { pdf_id: pdfId, role: 'user', content: message.trim(), model },
                { pdf_id: pdfId, role: 'assistant', content: fullReply, model },
              ])

            if (insertError) console.error('Failed to save chat messages:', insertError)
          }
        }
      },
    })

    return new Response(outStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
