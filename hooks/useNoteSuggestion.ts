import { useEffect, useState, RefObject } from 'react'
import { HighlightRect, PendingHighlight } from './useHighlightSelection'

export function useNoteSuggestion(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [pendingNote, setPendingNote] = useState<PendingHighlight | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPendingNote(null)
      return
    }

    const handleSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !containerRef.current) return

      const text = sel.toString().trim()
      if (!text || text.length < 20) return

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

      setPendingNote({
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

  const clearPendingNote = () => {
    setPendingNote(null)
    window.getSelection()?.removeAllRanges()
  }

  return { pendingNote, clearPendingNote }
}