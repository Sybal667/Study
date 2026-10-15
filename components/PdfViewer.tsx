'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

// Size of a page at scale 1 until the real size is read from the PDF.
const DEFAULT_PAGE_SIZE = { w: 595, h: 842 }

// Pages are only drawn when they are within this distance of the visible area
// (150% of the visible height above and below).
const PRELOAD_MARGIN = '150% 0px'

// Upper limit for the pixels in one page canvas. Keeps memory per page bounded
// when zoomed in.
const MAX_CANVAS_PIXELS = 14_000_000

interface PdfViewerProps {
  pdfUrl: string | null
  numPages: number | null
  scale: number
  rotation: number
  uploading: boolean
  onDocumentLoadSuccess: (result: { numPages: number }) => void
  generateThumbnails: (pdf: any) => Promise<void>
  // No longer called from here: the current page is now saved from scroll position.
  // Kept optional so existing callers still compile.
  updatePage?: (page: number) => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  highlights: Highlight[]
  openNoteHighlightId: number | null
  onToggleNote: (highlightId: number) => void
  highlightMode: boolean
  onUploadIntent?: () => void
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return null
}

export default function PdfViewer({
  pdfUrl,
  numPages,
  scale,
  rotation,
  uploading,
  onDocumentLoadSuccess,
  generateThumbnails,
  handleFileUpload,
  highlights,
  openNoteHighlightId,
  onToggleNote,
  highlightMode,
  onUploadIntent,
}: PdfViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [baseSize, setBaseSize] = useState(DEFAULT_PAGE_SIZE)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(() => new Set([1]))
  // Bumped every time a document finishes loading, so page tracking restarts
  // even when two documents have the same number of pages.
  const [loadToken, setLoadToken] = useState(0)

  // Size of one page at the current zoom/rotation. Used for placeholders so the
  // scrollbar and page positions are correct before pages are drawn.
  const pageSize = useMemo(() => {
    const swap = rotation % 180 !== 0
    const w = (swap ? baseSize.h : baseSize.w) * scale
    const h = (swap ? baseSize.w : baseSize.h) * scale
    return { w: Math.round(w), h: Math.round(h) }
  }, [baseSize, scale, rotation])

  // Cap the sharpness of the page canvases (retina screens would otherwise use 2x or more).
  const devicePixelRatio = useMemo(() => {
    const deviceRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    let ratio = Math.min(deviceRatio, 1.5)
    const pixels = pageSize.w * pageSize.h
    if (pixels > 0 && pixels * ratio * ratio > MAX_CANVAS_PIXELS) {
      ratio = Math.max(1, Math.sqrt(MAX_CANVAS_PIXELS / pixels))
    }
    return ratio
  }, [pageSize])

  // Group highlights by page once instead of filtering for every page.
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, Highlight[]>()
    for (const h of highlights) {
      const list = map.get(h.page_number)
      if (list) list.push(h)
      else map.set(h.page_number, [h])
    }
    return map
  }, [highlights])

  // Work out which pages are near the screen and should be drawn.
  useEffect(() => {
    const root = viewerRef.current
    if (!root || !pdfUrl || !numPages) return

    const intersecting = new Set<number>()

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false
        for (const entry of entries) {
          const pageNumber = Number((entry.target as HTMLElement).dataset.pageNumber)
          if (!pageNumber) continue
          if (entry.isIntersecting) {
            if (!intersecting.has(pageNumber)) {
              intersecting.add(pageNumber)
              changed = true
            }
          } else if (intersecting.delete(pageNumber)) {
            changed = true
          }
        }
        if (changed) setRenderedPages(new Set(intersecting))
      },
      { root: getScrollParent(root), rootMargin: PRELOAD_MARGIN, threshold: 0 }
    )

    root.querySelectorAll<HTMLElement>('[data-pdf-slot]').forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [pdfUrl, numPages, loadToken])

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
          data-tour="pdf-upload-button"
          onClick={() => onUploadIntent?.()}
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
    <div
      ref={viewerRef}
      data-tour="pdf-viewer"
      className={highlightMode ? 'highlight-mode-active' : ''}
      style={{ display: 'block', width: '100%' }}
    >
      <style>{textLayerFix}</style>
      <style>{highlightSelectionStyle}</style>
      <Document
        file={pdfUrl}
        onLoadSuccess={async (pdf) => {
          // Read the real page size so placeholders match the document.
          try {
            const firstPage = await pdf.getPage(1)
            const viewport = firstPage.getViewport({ scale: 1 })
            setBaseSize({ w: viewport.width, h: viewport.height })
            firstPage.cleanup()
          } catch (err) {
            console.error('Could not read first page size:', err)
          }

          setRenderedPages(new Set([1]))
          onDocumentLoadSuccess({ numPages: pdf.numPages })
          setLoadToken((t) => t + 1)
          // Thumbnails are now created lazily when the sidebar is opened.
          await generateThumbnails(pdf)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          {numPages &&
            Array.from(new Array(numPages), (_, index) => {
              const pageNumber = index + 1
              const isRendered = renderedPages.has(pageNumber)
              const pageHighlights = highlightsByPage.get(pageNumber) ?? []

              return (
                <div
                  key={`page_container_${pageNumber}`}
                  data-page-number={pageNumber}
                  data-pdf-slot=""
                  style={{
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    position: 'relative',
                    ...(isRendered
                      ? { width: 'fit-content' }
                      : {
                          width: pageSize.w,
                          height: pageSize.h,
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          opacity: 0.5,
                          fontSize: '14px',
                        }),
                  }}
                >
                  {isRendered ? (
                    <>
                      <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        rotate={rotation}
                        devicePixelRatio={devicePixelRatio}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        loading={
                          <div
                            style={{
                              width: pageSize.w,
                              height: pageSize.h,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              opacity: 0.7,
                            }}
                          >
                            Loading page...
                          </div>
                        }
                        onRenderError={(error) => {
                          if (error?.name === 'RenderingCancelledException') {
                            return
                          }
                          console.error(`Error rendering page ${pageNumber}:`, error)
                        }}
                      />
                      {pageHighlights.map((h) => {
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
                                  transform: 'translate(-4px, -10px)',
                                  cursor: 'pointer',
                                  fontSize: '11px',
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
                    </>
                  ) : (
                    <span>Page {pageNumber}</span>
                  )}
                </div>
              )
            })}
        </div>
      </Document>
    </div>
  )
}
