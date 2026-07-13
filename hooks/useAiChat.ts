import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  message_id: number
  role: 'user' | 'assistant'
  content: string
  model: string | null
  created_at: string
}

export function useAiChat(pdfUrl: string | null, model: string) {
  const [pdfId, setPdfId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const loadPdfIdAndHistory = async () => {
      setMessages([])
      setPdfId(null)

      if (!pdfUrl) return

      setLoadingHistory(true)

      const { data: pdfRow } = await supabase
        .from('student_pdfs')
        .select('pdf_id')
        .eq('file_url', pdfUrl)
        .single()

      if (!pdfRow) {
        setLoadingHistory(false)
        return
      }

      setPdfId(pdfRow.pdf_id)

      const { data: rows } = await supabase
        .from('pdf_chat_messages')
        .select('message_id, role, content, model, created_at')
        .eq('pdf_id', pdfRow.pdf_id)
        .eq('model', model)
        .order('created_at', { ascending: true })

      if (rows) setMessages(rows as ChatMessage[])
      setLoadingHistory(false)
    }

    loadPdfIdAndHistory()
  }, [pdfUrl, model])

  const sendMessage = async (text: string) => {
    if (!pdfId || !text.trim()) return

    setSending(true)

    const optimisticUser: ChatMessage = {
      message_id: -Date.now(),
      role: 'user',
      content: text,
      model: null,
      created_at: new Date().toISOString(),
    }

    const assistantId = -Date.now() - 1
    const assistantMessage: ChatMessage = {
      message_id: assistantId,
      role: 'assistant',
      content: '',
      model,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticUser, assistantMessage])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_id: pdfId, message: text, model }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Chat request failed:', data.error)
        setMessages((prev) => prev.filter((m) => m !== optimisticUser && m !== assistantMessage))
        return
      }

      if (!res.body) {
        console.error('Chat request failed: no response body')
        setMessages((prev) => prev.filter((m) => m !== optimisticUser && m !== assistantMessage))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue

        setMessages((prev) =>
          prev.map((m) => (m.message_id === assistantId ? { ...m, content: m.content + chunk } : m))
        )
      }
    } catch (err) {
      console.error('Chat request failed:', err)
      setMessages((prev) => prev.filter((m) => m !== optimisticUser && m !== assistantMessage))
    } finally {
      setSending(false)
    }
  }

  return { messages, loadingHistory, sending, sendMessage }
}