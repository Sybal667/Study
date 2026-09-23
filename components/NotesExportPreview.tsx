'use client'

import { PDFDocument, PDFName, rgb, StandardFonts, PDFPage } from 'pdf-lib'

interface HighlightRect {
    xPct: number
    yPct: number
    wPct: number
    hPct: number
}

interface Highlight {
    highlight_id: number
    page_number: number
    highlighted_text: string
    note: string | null
    rects: HighlightRect[]
}

interface NotesExportPreviewProps {
    highlights: Highlight[]
    pdfFileName: string | undefined
    pdfUrl: string | null
    onClose: () => void
}

export default function NotesExportPreview({
    highlights,
    pdfFileName,
    pdfUrl,
    onClose,
}: NotesExportPreviewProps) {
    const handleDownloadPdf = async () => {
        if (!pdfUrl) return

        try {
            const response = await fetch(pdfUrl)
            if (!response.ok) {
                throw new Error('Failed to load original PDF')
            }

            const originalPdfBytes = await response.arrayBuffer()
            const originalPdf = await PDFDocument.load(originalPdfBytes)
            const pdfDoc = await PDFDocument.create()

            const copiedPages = await pdfDoc.copyPages(
                originalPdf,
                originalPdf.getPageIndices()
            )
            copiedPages.forEach((page) => pdfDoc.addPage(page))

            const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

            const notesWithText = highlights.filter((h) => h.note)

            const wrapText = (text: string, size: number, maxWidth: number) => {
                const words = text.split(' ')
                const lines: string[] = []
                let line = ''
                for (const word of words) {
                    const test = line ? `${line} ${word}` : word
                    if (font.widthOfTextAtSize(test, size) > maxWidth) {
                        lines.push(line)
                        line = word
                    } else {
                        line = test
                    }
                }
                if (line) lines.push(line)
                return lines
            }

            // Records where each note ended up (which page + y position),
            // so the marker on the highlight page can link straight to it.
            const destinations = new Map<number, { page: PDFPage; y: number }>()

            // ---------- 1. Build the Notes page(s) first ----------
            if (notesWithText.length > 0) {
                let notesPage = pdfDoc.addPage()
                const bottomMargin = 50
                let currentY = notesPage.getSize().height - 95

                notesPage.drawText('Notes', {
                    x: 50,
                    y: notesPage.getSize().height - 60,
                    size: 18,
                    font,
                    color: rgb(0.1, 0.1, 0.1),
                })

                notesWithText.forEach((highlight, index) => {
                    const noteNumber = index + 1
                    const cleanHighlightedText = highlight.highlighted_text
                        .replace(/\s+/g, ' ')
                        .trim()

                    const heading = `[${noteNumber}] Page ${highlight.page_number} - ${cleanHighlightedText}`
                    const headingLines = wrapText(heading, 10, 450)
                    const noteLines = wrapText(highlight.note || '', 9, 450)

                    const entryHeight =
                        headingLines.length * 14 + 4 + noteLines.length * 12 + 20

                    // Start a fresh Notes page if this entry won't fit.
                    if (currentY - entryHeight < bottomMargin) {
                        notesPage = pdfDoc.addPage()
                        currentY = notesPage.getSize().height - 60
                    }

                    // This is where the [n] link on the highlight page will jump to.
                    destinations.set(highlight.highlight_id, {
                        page: notesPage,
                        y: currentY + 10,
                    })

                    headingLines.forEach((line) => {
                        notesPage.drawText(line, {
                            x: 50,
                            y: currentY,
                            size: 10,
                            font,
                            color: rgb(0.1, 0.1, 0.1),
                        })
                        currentY -= 14
                    })

                    currentY -= 4

                    noteLines.forEach((line) => {
                        notesPage.drawText(line, {
                            x: 65,
                            y: currentY,
                            size: 9,
                            font,
                            color: rgb(0.2, 0.2, 0.2),
                        })
                        currentY -= 12
                    })

                    currentY -= 20
                })
            }

            // ---------- 2. Draw highlights + clickable [n] markers ----------
            for (const highlight of highlights) {
                const pageIndex = highlight.page_number - 1
                if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue

                const page = pdfDoc.getPage(pageIndex)
                const { width, height } = page.getSize()

                for (const rect of highlight.rects) {
                    const x = rect.xPct * width
                    const rectWidth = rect.wPct * width
                    const rectHeight = rect.hPct * height
                    const y = height - rect.yPct * height - rectHeight

                    page.drawRectangle({
                        x,
                        y,
                        width: rectWidth,
                        height: rectHeight,
                        color: rgb(0.65, 1, 0.65),
                        opacity: 0.45,
                    })
                }

                if (highlight.note && highlight.rects.length > 0) {
                    const noteNumber =
                        notesWithText.findIndex(
                            (item) => item.highlight_id === highlight.highlight_id
                        ) + 1

                    const lastRect = highlight.rects[highlight.rects.length - 1]
                    const highlightRight = lastRect.xPct * width + lastRect.wPct * width
                    const highlightTop = height - lastRect.yPct * height

                    const markerX = Math.min(highlightRight - 2, width - 20)
                    const markerY = Math.min(highlightTop + 2, height - 10)
                    const markerLabel = `[${noteNumber}]`
                    const markerWidth = font.widthOfTextAtSize(markerLabel, 7)

                    // Draw it in a link-like color so it visually reads as clickable.
                    page.drawText(markerLabel, {
                        x: markerX,
                        y: markerY,
                        size: 7,
                        font,
                        color: rgb(0.1, 0.35, 0.85),
                    })

                    // Attach an actual clickable link that jumps to the note.
                    const dest = destinations.get(highlight.highlight_id)
                    if (dest) {
                        const linkAnnotation = pdfDoc.context.obj({
                            Type: 'Annot',
                            Subtype: 'Link',
                            Rect: [
                                markerX - 2,
                                markerY - 2,
                                markerX + markerWidth + 2,
                                markerY + 9,
                            ],
                            Border: [0, 0, 0],
                            Dest: [dest.page.ref, 'XYZ', 0, dest.y, 0],
                        })

                        const linkRef = pdfDoc.context.register(linkAnnotation)
                        const existingAnnots = page.node.Annots()

                        if (existingAnnots) {
                            existingAnnots.push(linkRef)
                        } else {
                            page.node.set(
                                PDFName.of('Annots'),
                                pdfDoc.context.obj([linkRef])
                            )
                        }
                    }
                }
            }

            const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false })

            const pdfBuffer = new ArrayBuffer(modifiedPdfBytes.byteLength)
            new Uint8Array(pdfBuffer).set(modifiedPdfBytes)

            const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')

            const originalName = pdfFileName || 'document.pdf'
            const baseName = originalName.toLowerCase().endsWith('.pdf')
                ? originalName.slice(0, -4)
                : originalName

            link.href = url
            link.download = `${baseName}-highlighted.pdf`

            document.body.appendChild(link)
            link.click()
            link.remove()

            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (error) {
            console.error('Failed to export highlighted PDF:', error)
        }
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
            }}
        >
            <div
                style={{
                    width: '70%',
                    maxWidth: '900px',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    color: 'black',
                    padding: '30px',
                    borderRadius: '12px',
                }}
            >
                <h2>Export PDF</h2>
                <p>
                    This will download the original PDF with your saved
                    highlights and clickable notes added.
                </p>

                {highlights.length === 0 && (
                    <p>No saved highlights or notes for this document.</p>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={!pdfUrl || highlights.length === 0}
                    >
                        Download PDF
                    </button>
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}