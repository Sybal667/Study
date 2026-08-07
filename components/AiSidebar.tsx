'use client'

import { useState, useEffect, useRef } from 'react'
import { floatingButtonStyle, navButtonStyle } from '@/lib/studyStyles'
import { AI_MODELS } from '@/lib/aiProviders/models'
import AiChatTab from './ai/AiChatTab'
import AiPracticeTab from './ai/AiPracticeTab'
import AiVideosTab from './ai/AiVideosTab'

interface AiSidebarProps {
  pdfUrl: string | null
  pdfId: number | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  width: number
  onWidthChange: (width: number) => void
  currentPage: number
  totalPages: number
}

const MIN_SIDEBAR_WIDTH = 320
const MAX_SIDEBAR_WIDTH = 900

export default function AiSidebar({ pdfUrl, pdfId, isOpen, onOpenChange, width, onWidthChange, currentPage, totalPages }: AiSidebarProps) {
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
  const [activeMainTab, setActiveMainTab] = useState<'ai' | 'videos'>('ai')
  const [activeAiTab, setActiveAiTab] = useState<'chat' | 'practice'>('chat')

  return (
    <>
      {!isOpen && (
        <button
          data-tour="ai-toggle-button"
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

          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
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

          {activeMainTab === 'ai' ? (
            <>
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
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

              {activeAiTab === 'chat' ? (
                <AiChatTab pdfUrl={pdfUrl} selectedModel={selectedModel} onSelectModel={setSelectedModel} />
             ) : (
                <AiPracticeTab pdfId={pdfId} currentPage={currentPage} totalPages={totalPages} />
              )}
            </>
          ) : (
            <AiVideosTab />
          )}
        </div>
      )}
    </>
  )
}