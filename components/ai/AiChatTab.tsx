'use client'

import { useState } from 'react'
import { navButtonStyle } from '@/lib/studyStyles'
import { useAiChat } from '@/hooks/useAiChat'
import ModelPicker from './ModelPicker'

interface AiChatTabProps {
  pdfUrl: string | null
  selectedModel: string
  onSelectModel: (id: string) => void
}

export default function AiChatTab({ pdfUrl, selectedModel, onSelectModel }: AiChatTabProps) {
  const [chatInput, setChatInput] = useState('')
  const { messages, loadingHistory, sending, sendMessage } = useAiChat(pdfUrl, selectedModel)

  const handleSend = () => {
    if (!chatInput.trim() || sending) return
    sendMessage(chatInput)
    setChatInput('')
  }

  return (
    <>
      <ModelPicker selectedModel={selectedModel} onSelect={onSelectModel} />

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!pdfUrl && (
          <div style={{ fontSize: '13px', opacity: 0.6, color: 'white' }}>
            Open a PDF to start chatting.
          </div>
        )}

        {pdfUrl && loadingHistory && (
          <div style={{ fontSize: '13px', opacity: 0.6, color: 'white' }}>Loading chat history...</div>
        )}

        {pdfUrl &&
          !loadingHistory &&
          messages.map((msg) => (
            <div
              key={msg.message_id}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: msg.role === 'user' ? 'rgba(30, 58, 138, 0.5)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          ))}

        {sending && (
          <div style={{ alignSelf: 'flex-start', fontSize: '13px', opacity: 0.6, color: 'white', fontStyle: 'italic' }}>
            Thinking...
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
        <input
          type="text"
          placeholder="Ask anything..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          disabled={!pdfUrl || sending}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!pdfUrl || sending}
          style={{
            ...navButtonStyle,
            padding: '12px 20px',
            backgroundColor: 'rgba(30, 58, 138, 0.6)',
            borderColor: 'rgba(255,255,255,0.2)',
            fontWeight: 'bold',
            color: 'white',
            opacity: !pdfUrl || sending ? 0.5 : 1,
            cursor: !pdfUrl || sending ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </>
  )
}