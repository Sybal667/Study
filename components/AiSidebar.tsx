'use client'

import { useState, useEffect, useRef } from 'react'
import { floatingButtonStyle, navButtonStyle } from '@/lib/studyStyles'
import { useAiChat } from '@/hooks/useAiChat'
import { AI_MODELS } from '@/lib/aiProviders/models'

interface AiSidebarProps {
  pdfUrl: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  width: number
  onWidthChange: (width: number) => void
}

const MIN_SIDEBAR_WIDTH = 320
const MAX_SIDEBAR_WIDTH = 900

export default function AiSidebar({ pdfUrl, isOpen, onOpenChange, width, onWidthChange }: AiSidebarProps) {
  const [chatInput, setChatInput] = useState('')
  const isDraggingRef = useRef(false)

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const newWidth = window.innerWidth - e.clientX
      const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth))
      onWidthChange(clamped)
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onWidthChange])
const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id)
  const { messages, loadingHistory, sending, sendMessage } = useAiChat(pdfUrl, selectedModel)

  const handleSend = () => {
    if (!chatInput.trim() || sending) return
    sendMessage(chatInput)
    setChatInput('')
  }
  
  const [activeMainTab, setActiveMainTab] = useState<'ai' | 'videos'>('ai')
  const [activeAiTab, setActiveAiTab] = useState<'chat' | 'practice'>('chat')
  const practiceQuestions = [
    {
      id: 1,
      question: 'What is the main concept discussed?',
      options: ['Option A', 'Option B', 'Option C', 'Option D']
    },
    {
      id: 2,
      question: 'Which statement is true about this topic?',
      options: ['Option A', 'Option B', 'Option C', 'Option D']
    }
  ]

  return (
    <>
  {!isOpen && (
        <button
          onClick={() => onOpenChange(true)}
          style={floatingButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.9)'
          }}
        >
          🤖 AI
        </button>
      )}

     {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: `${width}px`,
            height: '100vh',
            backgroundImage: 'url("/rasta")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 200,
            overflow: 'auto',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div
            onMouseDown={handleDragStart}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '6px',
              cursor: 'ew-resize',
              zIndex: 201,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: -1,
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '12px',
            }}
          >
            <button
              onClick={() => setActiveMainTab('ai')}
              style={{
                ...navButtonStyle,
                flex: 1,
                padding: '10px',
                backgroundColor: activeMainTab === 'ai' ? 'rgba(30, 58, 138, 0.6)' : 'rgba(255,255,255,0.05)',
                borderColor: activeMainTab === 'ai' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                fontWeight: activeMainTab === 'ai' ? 'bold' : 'normal',
                fontSize: '14px',
                color: 'white',
              }}
            >
              🤖 AI
            </button>
            <button
              onClick={() => setActiveMainTab('videos')}
              style={{
                ...navButtonStyle,
                flex: 1,
                padding: '10px',
                backgroundColor: activeMainTab === 'videos' ? 'rgba(30, 58, 138, 0.6)' : 'rgba(255,255,255,0.05)',
                borderColor: activeMainTab === 'videos' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                fontWeight: activeMainTab === 'videos' ? 'bold' : 'normal',
                fontSize: '14px',
                color: 'white',
              }}
            >
              🎬 Videos
            </button>
            <button
              onClick={() => onOpenChange(false)}
              style={{
                ...navButtonStyle,
                flex: 0.5,
                padding: '10px',
                backgroundColor: 'rgba(255, 0, 0, 0.2)',
                borderColor: 'rgba(255, 0, 0, 0.3)',
                fontWeight: 'bold',
                fontSize: '14px',
                color: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Content based on main tab */}
          {activeMainTab === 'ai' ? (
            <>
              {/* AI Sub Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  paddingBottom: '8px',
                }}
              >
                <button
                  onClick={() => setActiveAiTab('chat')}
                  style={{
                    ...navButtonStyle,
                    flex: 1,
                    padding: '8px',
                    backgroundColor: activeAiTab === 'chat' ? 'rgba(30, 58, 138, 0.4)' : 'transparent',
                    borderColor: activeAiTab === 'chat' ? 'rgba(255,255,255,0.2)' : 'transparent',
                    fontWeight: activeAiTab === 'chat' ? 'bold' : 'normal',
                    fontSize: '13px',
                    color: 'white',
                  }}
                >
                  💬 Chat
                </button>
                <button
                  onClick={() => setActiveAiTab('practice')}
                  style={{
                    ...navButtonStyle,
                    flex: 1,
                    padding: '8px',
                    backgroundColor: activeAiTab === 'practice' ? 'rgba(30, 58, 138, 0.4)' : 'transparent',
                    borderColor: activeAiTab === 'practice' ? 'rgba(255,255,255,0.2)' : 'transparent',
                    fontWeight: activeAiTab === 'practice' ? 'bold' : 'normal',
                    fontSize: '13px',
                    color: 'white',
                  }}
                >
                  📝 Practice
                </button>
              </div>

              {/* AI Tab Content */}
              {activeAiTab === 'chat' ? (
                <>
{/* Model picker  */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {AI_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        title={m.description}
                        style={{
                          ...navButtonStyle,
                          padding: '6px 10px',
                          fontSize: '11px',
                          backgroundColor:
                            selectedModel === m.id ? 'rgba(30, 58, 138, 0.6)' : 'rgba(255,255,255,0.05)',
                          borderColor: selectedModel === m.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                          color: 'white',
                        }}
                      >
                        {m.provider === 'groq' ? '⚡' : '✨'} {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Chat content */}
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
                            backgroundColor:
                              msg.role === 'user' ? 'rgba(30, 58, 138, 0.5)' : 'rgba(255,255,255,0.08)',
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
                      <div
                        style={{
                          alignSelf: 'flex-start',
                          fontSize: '13px',
                          opacity: 0.6,
                          color: 'white',
                          fontStyle: 'italic',
                        }}
                      >
                        Thinking...
                      </div>
                    )}
                  </div>
                  {/* Chat input */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      paddingTop: '12px',
                    }}
                  >
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
              ) : (
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {practiceQuestions.map((q) => (
                    <div
                      key={q.id}
                      style={{
                        padding: '16px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <div style={{ color: 'white', fontSize: '15px', marginBottom: '12px', fontWeight: 'bold' }}>
                        {q.question}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.options.map((option, index) => (
                          <button
                            key={index}
                            style={{
                              ...navButtonStyle,
                              padding: '10px 12px',
                              textAlign: 'left',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              borderColor: 'rgba(255,255,255,0.1)',
                              fontSize: '14px',
                              color: 'white',
                              width: '100%',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.3)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Videos tab content */
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4].map((video) => (
                <div
                  key={video}
                  style={{
                    ...navButtonStyle,
                    padding: '16px',
                    textAlign: 'left',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    color: 'white',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        backgroundColor: 'rgba(30, 58, 138, 0.4)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        flexShrink: 0,
                      }}
                    >
                      🎬
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '15px' }}>
                        Understanding Concept {video}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.6, display: 'flex', gap: '12px' }}>
                        <span>📊 {85 - video * 5}% match</span>
                        <span>⏱️ {12 + video}:{String(34 + video * 10).padStart(2, '0')}</span>
                        <span>👤 Teacher {video}</span>
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                        A comprehensive explanation of this topic with examples
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}