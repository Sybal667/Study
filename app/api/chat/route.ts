import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin' 
import { streamMessage } from '@/lib/aiProviders/router'
import type { ChatMessage } from '@/lib/aiProviders/gemini'

export async function POST(request: Request) {
  try {
    const { pdf_id, message, model } = (await request.json()) as {
      pdf_id: number
      message: string
      model: string
    }

    if (!pdf_id || !message || !model) {
      return NextResponse.json(
        { error: 'pdf_id, message and model are required' },
        { status: 400 }
      )
    }

    
    if (!supabaseAdmin) {
      console.error('❌ Supabase Admin client is not initialized')
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      )
    }

   
    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url')
      .eq('pdf_id', pdf_id)
      .maybeSingle()

    console.log('🔍 pdfErr:', pdfErr)
    console.log('🔍 pdfRow:', pdfRow)

    if (pdfErr || !pdfRow) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const { data: historyRows, error: historyErr } = await supabaseAdmin
      .from('pdf_chat_messages')
      .select('role, content')
      .eq('pdf_id', pdf_id)
      .eq('model', model)
      .order('created_at', { ascending: true })

    if (historyErr) {
      console.error('❌ History fetch error:', historyErr)
      return NextResponse.json({ error: historyErr.message }, { status: 500 })
    }

    const history: ChatMessage[] = (historyRows ?? []).map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }))

    let geminiStream: ReadableStream<Uint8Array>
    try {
      geminiStream = await streamMessage({
        pdfId: pdf_id,
        fileUrl: pdfRow.file_url,
        history,
        newMessage: message,
        model,
      })
    } catch (err) {
      console.error('Gemini chat failed:', err)

      if (err instanceof Error && err.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: 'Daily AI limit reached for this model — try again tomorrow, or switch models.' },
          { status: 429 }
        )
      }

      return NextResponse.json({ error: 'AI request failed, please try again' }, { status: 502 })
    }

    let fullReply = ''
    const decoder = new TextDecoder()

    const outStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = geminiStream.getReader()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            fullReply += decoder.decode(value, { stream: true })
            controller.enqueue(value)
          }
        } catch (streamErr) {
          console.error('❌ Error reading AI stream:', streamErr)
        } finally {
          controller.close()

         if (supabaseAdmin && fullReply) {
            const { error: insertErr } = await supabaseAdmin
              .from('pdf_chat_messages')
              .insert([
                { pdf_id, role: 'user', content: message, model },
                { pdf_id, role: 'assistant', content: fullReply, model },
              ])

            if (insertErr) {
              console.error('❌ Failed to save chat messages:', insertErr)
            } else {
              console.log('✅ Chat messages saved successfully!')
            }
          }
        }
      },
    })

    return new Response(outStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
    
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}