import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HighlightRect, PendingHighlight } from './useHighlightSelection'

export interface Highlight {
  highlight_id: number
  page_number: number
  highlighted_text: string
  note: string | null
  rects: HighlightRect[]
}

export function useHighlights(pdfId: number | null) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [openNoteHighlightId, setOpenNoteHighlightId] = useState<number | null>(null)

  useEffect(() => {
    const loadHighlights = async () => {
      setHighlights([])
      setOpenNoteHighlightId(null)

      if (!pdfId) return

      const { data: rows, error } = await supabase
        .from('pdf_highlights')
        .select('highlight_id, page_number, highlighted_text, note, rects')
        .eq('pdf_id', pdfId)

      if (error) {
        console.error('Failed to load highlights:', error)
        return
      }

      if (rows) {
        setHighlights(rows as Highlight[])
      }
    }

    loadHighlights()
  }, [pdfId])

  const saveHighlight = async (pending: PendingHighlight, note: string) => {
    if (!pdfId) {
      return
    }

    const { data, error } = await supabase
      .from('pdf_highlights')
      .insert({
        pdf_id: pdfId,
        page_number: pending.pageNumber,
        highlighted_text: pending.text,
        note: note.trim() || null,
        rects: pending.rects,
      })
      .select('highlight_id, page_number, highlighted_text, note, rects')
      .single()

    if (error) {
      console.error('Failed to save highlight:', error)
      return
    }

    if (data) {
      setHighlights((prev) => [...prev, data as Highlight])
    }
  }

  const toggleNote = (highlightId: number) => {
    setOpenNoteHighlightId((prev) =>
      prev === highlightId ? null : highlightId
    )
  }

  return {
    highlights,
    saveHighlight,
    openNoteHighlightId,
    toggleNote,
  }
}