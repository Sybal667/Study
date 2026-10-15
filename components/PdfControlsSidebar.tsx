'use client'

import { useState } from 'react'
import {
  getPdfControlsContainerStyle,
  pdfFileNameStyle,
  pdfControlGroupStyle,
  pdfControlButtonStyle,
} from '@/lib/studyStyles'

interface PdfControlsSidebarProps {
  pdfFileName: string | undefined
  scale: number
  showPdfControls: boolean
  openPdfControls: () => void
  closePdfControlsDelayed: () => void
  zoomIn: () => void
  zoomOut: () => void
  fitToScreen: () => void
  onShowThumbnails: () => void
  rotatePage: () => void
  highlightMode: boolean
  onToggleHighlightMode: () => void
  onExport: () => void
  currentPage: number
  numPages: number | null
  onGoToPage: (page: number) => void
}

export default function PdfControlsSidebar({
  pdfFileName,
  scale,
  showPdfControls,
  openPdfControls,
  closePdfControlsDelayed,
  zoomIn,
  zoomOut,
  fitToScreen,
  onShowThumbnails,
  rotatePage,
  highlightMode,
  onToggleHighlightMode,
  onExport,
  currentPage,
  numPages,
  onGoToPage,
}: PdfControlsSidebarProps) {
  // null = show the live current page; a string = the student is typing a page number.
  const [pageDraft, setPageDraft] = useState<string | null>(null)

  const commitPage = () => {
    if (pageDraft === null) return
    const parsed = parseInt(pageDraft, 10)
    if (!isNaN(parsed) && numPages) {
      const clamped = Math.max(1, Math.min(parsed, numPages))
      if (clamped !== currentPage) onGoToPage(clamped)
    }
    setPageDraft(null)
  }

  return (
    <div
      style={getPdfControlsContainerStyle(showPdfControls)}
      onMouseEnter={openPdfControls}
      onMouseLeave={closePdfControlsDelayed}
    >
      {/* File Name */}
      <div style={pdfFileNameStyle}>📄 {pdfFileName || 'Document.pdf'}</div>

{/* Zoom Controls */}
      <div style={pdfControlGroupStyle}>
        <button onClick={zoomOut} style={pdfControlButtonStyle}>
          − Zoom Out
        </button>
        <span style={{ color: 'white', fontSize: '14px', minWidth: '50px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={zoomIn} style={pdfControlButtonStyle}>
          + Zoom In
        </button>
        <button data-tour="pdf-controls-fit" onClick={fitToScreen} style={pdfControlButtonStyle}>
          ⊡ Fit
        </button>
<button data-tour="pdf-controls-thumbnails" style={pdfControlButtonStyle} onClick={onShowThumbnails}>
          📑 Pages
        </button>
      </div>

      {/* Go to page */}
      <div style={pdfControlGroupStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '14px' }}>
          <span style={{ opacity: 0.7 }}>Page</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Go to page"
            value={pageDraft ?? String(currentPage)}
            onFocus={(e) => {
              setPageDraft(String(currentPage))
              e.target.select()
            }}
            onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitPage()
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setPageDraft(null)
                e.currentTarget.blur()
              }
            }}
            onBlur={commitPage}
            style={{
              width: '52px',
              padding: '6px',
              textAlign: 'center',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.25)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <span style={{ opacity: 0.7 }}>/ {numPages ?? '–'}</span>
        </div>
        <button
          style={pdfControlButtonStyle}
          // mouse down runs before the input's blur, so the page is only committed once
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitPage}
        >
          ➜ Go
        </button>
      </div>


      {/* Divider */}
      <div style={{ width: '80%', height: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }} />

      {/* Action Buttons */}
<div style={pdfControlGroupStyle}><button data-tour="pdf-controls-rotate" style={pdfControlButtonStyle} onClick={rotatePage}>🔄</button>
 <button
          data-tour="pdf-controls-highlight"
          style={{
            ...pdfControlButtonStyle,
            backgroundColor: highlightMode ? 'rgba(76,175,80,0.35)' : pdfControlButtonStyle.backgroundColor,
            border: highlightMode ? '1px solid rgba(76,175,80,0.8)' : pdfControlButtonStyle.border,
          }}
          onClick={onToggleHighlightMode}
        >
          ✏️
        </button>
<button data-tour="pdf-controls-download" style={pdfControlButtonStyle} onClick={onExport}>⬇️export</button>
      </div>
    </div>
  )
}
