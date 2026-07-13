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

export function useHighlights(pdfUrl: string | null) {
  const [pdfId, setPdfId] = useState<number | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [openNoteHighlightId, setOpenNoteHighlightId] = useState<number | null>(null)

  useEffect(() => {
    const loadPdfIdAndHighlights = async () => {
      setHighlights([])
      setPdfId(null)
      setOpenNoteHighlightId(null)

      if (!pdfUrl) return

      const { data: pdfRow } = await supabase
        .from('student_pdfs')
        .select('pdf_id')
        .eq('file_url', pdfUrl)
        .single()

      if (!pdfRow) return
      setPdfId(pdfRow.pdf_id)

      const { data: rows } = await supabase
        .from('pdf_highlights')
        .select('highlight_id, page_number, highlighted_text, note, rects')
        .eq('pdf_id', pdfRow.pdf_id)

      if (rows) setHighlights(rows as Highlight[])
    }

    loadPdfIdAndHighlights()
  }, [pdfUrl])

  const saveHighlight = async (pending: PendingHighlight, note: string) => {
    if (!pdfId) return

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
    setOpenNoteHighlightId((prev) => (prev === highlightId ? null : highlightId))
  }

  return { highlights, saveHighlight, openNoteHighlightId, toggleNote }
}