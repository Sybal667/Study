'use client'

import { useRef, useState } from 'react'
import { navButtonStyle } from '@/lib/studyStyles'
import { useAiChat } from '@/hooks/useAiChat'
import ModelPicker from './ModelPicker'
import VisualResult from './VisualResult'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface VisualData {
  type: 'none' | 'mermaid' | 'graph'
  title: string
  explanation: string
  mermaid: string
  graph: {
    xLabel?: string
    yLabel?: string
    points: { x: number; y: number }[]
  }
}

interface AiChatTabProps {
  pdfUrl: string | null
  selectedModel: string
  onSelectModel: (id: string) => void
}

export default function AiChatTab({
  pdfUrl,
  selectedModel,
  onSelectModel,
}: AiChatTabProps) {
  const [chatInput, setChatInput] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [pasteError, setPasteError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [visuals, setVisuals] = useState<Record<number, VisualData>>({})
  const [visualLoading, setVisualLoading] = useState<Record<number, boolean>>({})
  const [visualErrors, setVisualErrors] = useState<Record<number, string>>({})

  const {
    pdfId,
    messages,
    loadingHistory,
    sending,
    sendMessage,
  } = useAiChat(pdfUrl, selectedModel)

  const handleSend = () => {
    if ((!chatInput.trim() && !imageData) || sending) return
    if (imageData && selectedModel === 'openai/gpt-oss-120b') {
      setPasteError('Screenshot analysis is not supported by this model. Switch to Gemini to send screenshots.')
      return
    }

    void sendMessage(chatInput, imageData)
    setChatInput('')
    setImageData(null)
    setPasteError('')
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(event.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    event.preventDefault()
    setPasteError('')

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setPasteError('Paste a PNG, JPEG, WEBP, or GIF screenshot.')
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      setPasteError('The screenshot must be 3 MB or smaller.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageData(reader.result)
    }
    reader.onerror = () => setPasteError('Could not read the pasted screenshot.')
    reader.readAsDataURL(file)
  }

  const generateVisual = async (
    messageId: number,
    question: string,
    answer: string,
    model: string,
  ) => {
    if (!pdfId || visualLoading[messageId]) return

    setVisualLoading((prev) => ({ ...prev, [messageId]: true }))
    setVisualErrors((prev) => {
      const next = { ...prev }
      delete next[messageId]
      return next
    })

    try {
      const response = await fetch('/api/chat/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_id: pdfId, question, answer, model }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not generate visual.')

      setVisuals((prev) => ({ ...prev, [messageId]: data as VisualData }))
    } catch (error) {
      setVisualErrors((prev) => ({
        ...prev,
        [messageId]: error instanceof Error ? error.message : 'Could not generate visual.',
      }))
    } finally {
      setVisualLoading((prev) => ({ ...prev, [messageId]: false }))
    }
  }

  return (
    <>
      <ModelPicker selectedModel={selectedModel} onSelect={onSelectModel} />

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {!pdfUrl && <div style={messageStyle}>Open a PDF to start chatting.</div>}
        {pdfUrl && loadingHistory && <div style={messageStyle}>Loading chat history...</div>}

        {pdfUrl && !loadingHistory && messages.map((msg, index) => {
          const isAssistant = msg.role === 'assistant'
          let question = ''

          if (isAssistant) {
            for (let i = index - 1; i >= 0; i--) {
              if (messages[i].role === 'user') {
                question = messages[i].content
                break
              }
            }
          }

          return (
            <div
              key={msg.message_id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '100%',
                width: isAssistant ? '100%' : 'fit-content',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 10,
                backgroundColor: msg.role === 'user' ? 'rgba(30,58,138,0.5)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {msg.imageData && (
                <img
                  src={msg.imageData}
                  alt="Pasted screenshot"
                  style={{ display: 'block', maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 8, marginBottom: 8 }}
                />
              )}
              {msg.content && (
                <div className="ai-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}

              {isAssistant && msg.content.trim() && msg.message_id > 0 && question.trim() && (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    disabled={!pdfId || visualLoading[msg.message_id]}
                    onClick={() => void generateVisual(msg.message_id, question, msg.content, msg.model || selectedModel)}
                    style={{
                      ...navButtonStyle,
                      padding: '6px 10px',
                      fontSize: 12,
                      color: 'white',
                      backgroundColor: 'rgba(30,58,138,0.5)',
                      borderColor: 'rgba(255,255,255,0.2)',
                      opacity: visualLoading[msg.message_id] ? 0.6 : 1,
                      cursor: visualLoading[msg.message_id] ? 'wait' : 'pointer',
                    }}
                  >
                    {visualLoading[msg.message_id] ? 'Generating visual...' : visuals[msg.message_id] ? 'Regenerate visual' : 'Visual'}
                  </button>

                  {visualErrors[msg.message_id] && <p style={messageStyle}>{visualErrors[msg.message_id]}</p>}
                  {visuals[msg.message_id] && <VisualResult visual={visuals[msg.message_id]} />}
                </div>
              )}
            </div>
          )
        })}

        {sending && <div style={messageStyle}>Thinking...</div>}
      </div>

      {imageData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}>
          <img src={imageData} alt="Screenshot attachment preview" style={{ maxWidth: 180, maxHeight: 120, objectFit: 'contain', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }} />
          <button
            type="button"
            onClick={() => setImageData(null)}
            disabled={sending}
            style={{ ...navButtonStyle, color: 'white', padding: '6px 10px' }}
          >
            Remove screenshot
          </button>
        </div>
      )}

      {pasteError && <p style={{ ...messageStyle, color: '#fca5a5', opacity: 1 }}>{pasteError}</p>}

      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask anything... (paste a screenshot with Ctrl+V)"
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSend()
          }}
          disabled={!pdfUrl || sending}
          style={{
            width: '100%',
            minWidth: 0,
            padding: 12,
            fontSize: 16,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            outline: 'none',
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!pdfUrl || sending || (!chatInput.trim() && !imageData)}
          style={{
            ...navButtonStyle,
            padding: '12px 20px',
            backgroundColor: 'rgba(30,58,138,0.6)',
            borderColor: 'rgba(255,255,255,0.2)',
            fontWeight: 'bold',
            color: 'white',
            opacity: !pdfUrl || sending || (!chatInput.trim() && !imageData) ? 0.5 : 1,
            cursor: !pdfUrl || sending || (!chatInput.trim() && !imageData) ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </>
  )
}

const messageStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  opacity: 0.75,
  color: 'white',
}
