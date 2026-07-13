import { useEffect, useState, RefObject } from 'react'

export interface HighlightRect {
  xPct: number
  yPct: number
  wPct: number
  hPct: number
}

export interface PendingHighlight {
  text: string
  pageNumber: number
  rects: HighlightRect[]
  popupX: number
  popupY: number
}

export function useHighlightSelection(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [pendingHighlight, setPendingHighlight] = useState<PendingHighlight | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPendingHighlight(null)
      return
    }

    const handleSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !containerRef.current) return

      const text = sel.toString().trim()
      if (!text) return

      const range = sel.getRangeAt(0)

      let node: Node | null = range.commonAncestorContainer
      let pageEl: HTMLElement | null = null
      while (node) {
        if (node instanceof HTMLElement && node.dataset.pageNumber) {
          pageEl = node
          break
        }
        node = node.parentNode
      }
      if (!pageEl) return

      const pageRect = pageEl.getBoundingClientRect()
      const clientRects = Array.from(range.getClientRects())

      const rects: HighlightRect[] = clientRects
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({
          xPct: (r.left - pageRect.left) / pageRect.width,
          yPct: (r.top - pageRect.top) / pageRect.height,
          wPct: r.width / pageRect.width,
          hPct: r.height / pageRect.height,
        }))

      if (rects.length === 0) return

      const lastRect = clientRects[clientRects.length - 1]

      setPendingHighlight({
        text,
        pageNumber: Number(pageEl.dataset.pageNumber),
        rects,
        popupX: lastRect.left,
        popupY: lastRect.bottom + 8,
      })
    }

    document.addEventListener('mouseup', handleSelection)
    return () => document.removeEventListener('mouseup', handleSelection)
  }, [enabled, containerRef])

  const clearPendingHighlight = () => {
    setPendingHighlight(null)
    window.getSelection()?.removeAllRanges()
  }

  return { pendingHighlight, clearPendingHighlight }
}