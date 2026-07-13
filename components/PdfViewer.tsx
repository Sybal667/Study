'use client'

import dynamic from 'next/dynamic'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { navButtonStyle } from '@/lib/studyStyles'
import { Highlight } from '@/hooks/useHighlights'

const textLayerFix = `
  .react-pdf__Page__textContent span {
    line-height: 1 !important;
  }
`

const highlightSelectionStyle = `
  .highlight-mode-active .react-pdf__Page__textContent span::selection {
    background-color: rgba(76, 175, 80, 0.6);
    color: transparent;
  }
`

const Document = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false })
const Page = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })


interface PdfViewerProps {
  pdfUrl: string | null
  numPages: number | null
  scale: number
  rotation: number
  uploading: boolean
  onDocumentLoadSuccess: (result: { numPages: number }) => void
  generateThumbnails: (pdf: any) => Promise<void>
  updatePage: (page: number) => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  highlights: Highlight[]
  openNoteHighlightId: number | null
  onToggleNote: (highlightId: number) => void
  highlightMode: boolean
}

export default function PdfViewer({
  pdfUrl,
  numPages,
  scale,
  rotation,
  uploading,
  onDocumentLoadSuccess,
  generateThumbnails,
  updatePage,
  handleFileUpload,
  highlights,
  openNoteHighlightId,
  onToggleNote,
  highlightMode ,
}: PdfViewerProps) {
  if (!pdfUrl) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center',
          zIndex: 1,
          marginTop: '10vh',
        }}
      >
        <div style={{ fontSize: '48px' }}>📄</div>
        <div style={{ color: 'white', opacity: 0.7 }}>No PDF loaded yet</div>
        <label
          style={{
            ...navButtonStyle,
            padding: '12px 24px',
            backgroundColor: 'rgba(30, 58, 138, 0.8)',
            fontSize: '16px',
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          {uploading ? 'Uploading...' : '📤 Upload PDF'}
          <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>
    )
  }

  return (
    <div style={{ display: 'block', width: '100%' }}>
       <style>{textLayerFix}</style>
       <style>{highlightSelectionStyle}</style>
      <Document
        file={pdfUrl}
        onLoadSuccess={async (pdf) => {
          onDocumentLoadSuccess({ numPages: pdf.numPages })
          await generateThumbnails(pdf)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          {numPages &&
            Array.from(new Array(numPages), (_, index) => (
              <div
                key={`page_container_${index + 1}`}
                data-page-number={index + 1}
                style={{
                  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  width: 'fit-content',
                  position: 'relative',
                }}
              >
                <Page
                  pageNumber={index + 1}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={<div style={{ color: 'white', opacity: 0.7, padding: '20px' }}>Loading page...</div>}
                  onRenderSuccess={() => {
                    updatePage(index + 1)
                  }}
                />
                {highlights
                  .filter((h) => h.page_number === index + 1)
                  .map((h) => {
                    const lastRect = h.rects[h.rects.length - 1]
                    return (
                      <div key={h.highlight_id}>
                        {h.rects.map((r, i) => (
                          <div
                            key={i}
                            style={{
                              position: 'absolute',
                              left: `${r.xPct * 100}%`,
                              top: `${r.yPct * 100}%`,
                              width: `${r.wPct * 100}%`,
                              height: `${r.hPct * 100}%`,
                              backgroundColor: 'rgba(0, 200, 83, 0.35)',
                              pointerEvents: 'none',
                            }}
                          />
                        ))}
                        {h.note && (
                          <div
                            onClick={() => onToggleNote(h.highlight_id)}
                            style={{
                              position: 'absolute',
                              left: `${(lastRect.xPct + lastRect.wPct) * 100}%`,
                              top: `${lastRect.yPct * 100}%`,
                              transform: 'translate(4px, -4px)',
                              cursor: 'pointer',
                              fontSize: '16px',
                              zIndex: 10,
                            }}
                          >
                              🤔
                            {openNoteHighlightId === h.highlight_id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '20px',
                                  left: 0,
                                  minWidth: 160,
                                  maxWidth: 240,
                                  background: 'rgba(0,0,0,0.9)',
                                  backdropFilter: 'blur(8px)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  borderRadius: 6,
                                  padding: 8,
                                  color: '#fff',
                                  fontSize: 12,
                                  zIndex: 20,
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {h.note}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            ))}
        </div>
      </Document>
    </div>
  )
}
