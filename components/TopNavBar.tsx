'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getNavContainerStyle, navButtonStyle } from '@/lib/studyStyles'
import MusicDropdownContent from './MusicDropdownContent'

interface TopNavBarProps {
  showNav: boolean
  openNav: () => void
  closeNavDelayed: () => void
  documents: any[]
  onOpenDocument: (doc: any) => void
  onImportNew: () => void
  onDeleteDocument: (doc: any) => void
  forceImportOpen?: boolean
  onUploadIntent?: () => void
}

const MAX_DOCUMENTS_PER_MODULE = 3

export default function TopNavBar({
  showNav,
  openNav,
  closeNavDelayed,
  documents,
  onOpenDocument,
  onImportNew,
  onDeleteDocument,
  forceImportOpen = false,
  onUploadIntent,

}: TopNavBarProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [musicOpen, setMusicOpen] = useState(false)
  const [isMusicDropdownHovered, setIsMusicDropdownHovered] = useState(false)
  const musicTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  useEffect(() => {
    return () => {
      if (musicTimeoutRef.current) {
        clearTimeout(musicTimeoutRef.current)
      }
    }
  }, [])

  const handleMusicToggle = () => {
    if (musicOpen) {
      setMusicOpen(false)
      if (musicTimeoutRef.current) {
        clearTimeout(musicTimeoutRef.current)
        musicTimeoutRef.current = null
      }
    } else {
      if (musicTimeoutRef.current) {
        clearTimeout(musicTimeoutRef.current)
        musicTimeoutRef.current = null
      }
      setMusicOpen(true)
    }
  }

  const handleMusicMouseEnter = () => {
    setIsMusicDropdownHovered(true)
    if (musicTimeoutRef.current) {
      clearTimeout(musicTimeoutRef.current)
      musicTimeoutRef.current = null
    }
  }

  const handleMusicMouseLeave = () => {
    setIsMusicDropdownHovered(false)
  }

  const handleMusicButtonClick = () => {
    if (musicOpen) {
      setMusicOpen(false)
      if (musicTimeoutRef.current) {
        clearTimeout(musicTimeoutRef.current)
        musicTimeoutRef.current = null
      }
    } else {
      setMusicOpen(true)
      if (musicTimeoutRef.current) {
        clearTimeout(musicTimeoutRef.current)
        musicTimeoutRef.current = null
      }
    }
  }

  const handleNavMouseLeave = () => {
    if (musicOpen) return
    closeNavDelayed()
  }

  return (
    <div style={getNavContainerStyle(showNav)} onMouseEnter={openNav} onMouseLeave={handleNavMouseLeave}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
        <div style={{ position: 'relative' }}>
          <button data-tour="top-nav-import" style={navButtonStyle} onClick={() => setImportOpen(!importOpen)}>
            📥 Import
          </button>

          {(importOpen || forceImportOpen) && (
            <div
              style={{
                position: 'absolute',
                top: '40px',
                left: 0,
                backgroundColor: 'rgba(0,0,0,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                minWidth: '320px',
                padding: '8px',
                zIndex: 999,
              }}
            >
         <button
                data-tour="top-nav-import-new"
                style={{
                  ...navButtonStyle,
                  opacity: documents.length >= MAX_DOCUMENTS_PER_MODULE ? 0.4 : 1,
                  cursor: documents.length >= MAX_DOCUMENTS_PER_MODULE ? 'not-allowed' : 'pointer',
                }}
                disabled={documents.length >= MAX_DOCUMENTS_PER_MODULE}
                title={
                  documents.length >= MAX_DOCUMENTS_PER_MODULE
                    ? 'Maximum of 3 PDFs per module — delete one to add another'
                    : undefined
                }
                onClick={() => {
                  if (documents.length >= MAX_DOCUMENTS_PER_MODULE) return
                  onUploadIntent?.()
                  onImportNew()
                }}
              >
                ➕ Import new PDF
              </button>

              {documents.length > 0 && (
                <div data-tour="top-nav-history">
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
                  {documents.map((doc, i) => (
                    <div key={doc.pdf_id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        style={{ ...navButtonStyle, flex: 1, textAlign: 'left' }}
                        onClick={async () => {
                          setImportOpen(false)
                          await onOpenDocument(doc)
                        }}
                      >
                        📄 {doc.file_name || `Document ${i + 1}`}
                      </button>
                      <button
                        style={{
                          ...navButtonStyle,
                          padding: '8px 10px',
                          backgroundColor: 'rgba(255,107,107,0.15)',
                        }}
                        title="Delete this PDF"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await onDeleteDocument(doc)
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button data-tour="top-nav-music" style={navButtonStyle} onClick={handleMusicButtonClick}>
            🎵 Music
          </button>

          {musicOpen && (
            <div
              onMouseEnter={handleMusicMouseEnter}
              onMouseLeave={handleMusicMouseLeave}
              style={{
                position: 'absolute',
                top: '40px',
                left: '0', 
                backgroundColor: 'rgba(0,0,0,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                width: '380px',
                maxHeight: '500px',
                padding: '16px',
                zIndex: 999,
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
              }}
            >
              <MusicDropdownContent
                onClose={() => {
                  setMusicOpen(false)
                  if (musicTimeoutRef.current) {
                    clearTimeout(musicTimeoutRef.current)
                    musicTimeoutRef.current = null
                  }
                  closeNavDelayed()
                }}
              />
            </div>
          )}
        </div>

        <button data-tour="top-nav-notes" style={navButtonStyle}>📝 Notes</button>
        <button data-tour="top-nav-change-module" style={navButtonStyle} onClick={() => router.push('/SelectModule')}>
          🔁 Change Module
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
<button
          data-tour="top-nav-profile"
          style={{
            ...navButtonStyle,
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          👤
        </button>
      </div>
    </div>
  )
}