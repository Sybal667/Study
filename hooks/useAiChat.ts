import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  message_id: number
  role: 'user' | 'assistant'
  content: string
  model: string | null
  created_at: string
  imageData?: string | null
}

export function useAiChat(pdfUrl: string | null, model: string) {
  const [pdfId, setPdfId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadPdfIdAndHistory = async () => {
      setMessages([])
      setPdfId(null)

      if (!pdfUrl) {
        setLoadingHistory(false)
        return
      }

      setLoadingHistory(true)

      try {
        const { data: pdfRow } = await supabase
          .from('student_pdfs')
          .select('pdf_id')
          .eq('file_url', pdfUrl)
          .single()

        if (cancelled) return

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

        if (cancelled) return

        if (rows) {
          setMessages(rows as ChatMessage[])
        }
      } catch (error) {
        console.error('Failed to load chat history:', error)
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    void loadPdfIdAndHistory()

    return () => {
      cancelled = true
    }
  }, [pdfUrl, model])

  const sendMessage = async (text: string, imageData?: string | null) => {
    if (!pdfId || (!text.trim() && !imageData) || sending) return

    const messageText = text.trim() || 'Please analyze this screenshot.'
    setSending(true)

    const optimisticUser: ChatMessage = {
      message_id: -Date.now(),
      role: 'user',
      content: messageText,
      model: null,
      created_at: new Date().toISOString(),
      imageData: imageData ?? null,
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
        body: JSON.stringify({
          pdf_id: pdfId,
          message: messageText,
          model,
          imageData: imageData ?? null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Chat request failed:', data.error)
        setMessages((prev) =>
          prev.filter(
            (message) =>
              message.message_id !== optimisticUser.message_id &&
              message.message_id !== assistantId,
          ),
        )
        return
      }

      if (!res.body) {
        console.error('Chat request failed: no response body')
        setMessages((prev) =>
          prev.filter(
            (message) =>
              message.message_id !== optimisticUser.message_id &&
              message.message_id !== assistantId,
          ),
        )
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
          prev.map((message) =>
            message.message_id === assistantId
              ? { ...message, content: message.content + chunk }
              : message,
          ),
        )
      }

      const remaining = decoder.decode()
      if (remaining) {
        setMessages((prev) =>
          prev.map((message) =>
            message.message_id === assistantId
              ? { ...message, content: message.content + remaining }
              : message,
          ),
        )
      }
    } catch (error) {
      console.error('Chat request failed:', error)
      setMessages((prev) =>
        prev.filter(
          (message) =>
            message.message_id !== optimisticUser.message_id &&
            message.message_id !== assistantId,
        ),
      )
    } finally {
      setSending(false)
    }
  }

  return { pdfId, messages, loadingHistory, sending, sendMessage }
}
