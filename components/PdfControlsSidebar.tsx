'use client'

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
}: PdfControlsSidebarProps) {
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
        <button onClick={fitToScreen} style={pdfControlButtonStyle}>
          ⊡ Fit
        </button>
        <button style={pdfControlButtonStyle} onClick={onShowThumbnails}>
          📑 Pages
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: '80%', height: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }} />

      {/* Action Buttons */}
<div style={pdfControlGroupStyle}><button style={pdfControlButtonStyle} onClick={rotatePage}>🔄</button>
        <button
          style={{
            ...pdfControlButtonStyle,
            backgroundColor: highlightMode ? 'rgba(76,175,80,0.35)' : pdfControlButtonStyle.backgroundColor,
            border: highlightMode ? '1px solid rgba(76,175,80,0.8)' : pdfControlButtonStyle.border,
          }}
          onClick={onToggleHighlightMode}
        >
          ✏️
        </button>
        <button style={pdfControlButtonStyle}>⬇️</button>
        <button style={pdfControlButtonStyle}>🖨️</button>
      </div>
    </div>
  )
}
