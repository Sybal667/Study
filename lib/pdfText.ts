import { supabaseAdmin } from '@/lib/supabaseAdmin'
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

export async function getPdfText(pdfId: number, fileUrl: string): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin is not initialized')
  }

  const { data: cached, error: cacheErr } = await supabaseAdmin
    .from('pdf_text_content')
    .select('full_text')
    .eq('pdf_id', pdfId)
    .maybeSingle()

  if (cacheErr) {
    console.error('❌ Failed to check pdf_text_content cache:', cacheErr)
  }

  if (cached?.full_text) {
    return cached.full_text
  }

  const res = await fetch(fileUrl)
  if (!res.ok) {
    throw new Error(`Failed to download PDF for text extraction (${res.status})`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const parsed = await pdfParse(buffer)
  const fullText: string = parsed.text ?? ''
  const pageCount: number = parsed.numpages ?? 0

  //  Cache it for next time
  const { error: insertErr } = await supabaseAdmin
    .from('pdf_text_content')
    .insert([{ pdf_id: pdfId, full_text: fullText, page_count: pageCount }])

  if (insertErr) {
    console.error('❌ Failed to cache extracted PDF text:', insertErr)
  }

  return fullText
}
