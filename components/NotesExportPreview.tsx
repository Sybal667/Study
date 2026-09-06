'use client'

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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

            copiedPages.forEach((page) => {
                pdfDoc.addPage(page)
            })

            const font = await pdfDoc.embedFont(
                StandardFonts.Helvetica
            )

            const notesWithText = highlights.filter(
                (highlight) => highlight.note
            )

            // Add highlights and note numbers to original pages.
            for (const highlight of highlights) {
                const pageIndex = highlight.page_number - 1

                if (
                    pageIndex < 0 ||
                    pageIndex >= pdfDoc.getPageCount()
                ) {
                    continue
                }

                const page = pdfDoc.getPage(pageIndex)
                const { width, height } = page.getSize()

                // Draw green highlights.
                for (const rect of highlight.rects) {
                    const x = rect.xPct * width
                    const rectWidth = rect.wPct * width
                    const rectHeight = rect.hPct * height

                    const y =
                        height -
                        rect.yPct * height -
                        rectHeight

                    page.drawRectangle({
                        x,
                        y,
                        width: rectWidth,
                        height: rectHeight,
                        color: rgb(0.65, 1, 0.65),
                        opacity: 0.45,
                    })
                }

                // Draw a small note number beside highlights
                // that have a saved note.
                if (
                    highlight.note &&
                    highlight.rects.length > 0
                ) {
                    const noteNumber =
                        notesWithText.findIndex(
                            (item) =>
                                item.highlight_id ===
                                highlight.highlight_id
                        ) + 1

                    const lastRect =
                        highlight.rects[
                        highlight.rects.length - 1
                        ]

                    const highlightRight =
                        lastRect.xPct * width +
                        lastRect.wPct * width

                    const highlightTop =
                        height -
                        lastRect.yPct * height

                    const markerX = Math.min(
                        highlightRight - 2,
                        width - 20
                    )

                    const markerY = Math.min(
                        highlightTop + 2,
                        height - 10
                    )

                    page.drawText(`[${noteNumber}]`, {
                        x: markerX,
                        y: markerY,
                        size: 7,
                        font,
                        color: rgb(0.2, 0.2, 0.2),
                    })
                }
            }

            // Add a separate Notes page.
            if (notesWithText.length > 0) {
                const notesPage = pdfDoc.addPage()
                const { height } = notesPage.getSize()

                notesPage.drawText('Notes', {
                    x: 50,
                    y: height - 60,
                    size: 18,
                    font,
                    color: rgb(0.1, 0.1, 0.1),
                })

                let currentY = height - 95

                notesWithText.forEach(
                    (highlight, index) => {
                        const noteNumber = index + 1

                        const cleanHighlightedText =
                            highlight.highlighted_text.replace(/\s+/g, ' ').trim()

                        const heading =
                            `[${noteNumber}] Page ${highlight.page_number} - ${cleanHighlightedText}`

                        const maxWidth = 450
                        const headingFontSize = 10
                        const words = heading.split(' ')
                        const headingLines: string[] = []

                        let currentLine = ''

                        for (const word of words) {
                            const testLine =
                                currentLine
                                    ? `${currentLine} ${word}`
                                    : word

                            const lineWidth =
                                font.widthOfTextAtSize(
                                    testLine,
                                    headingFontSize
                                )

                            if (lineWidth > maxWidth) {
                                headingLines.push(currentLine)
                                currentLine = word
                            } else {
                                currentLine = testLine
                            }
                        }

                        if (currentLine) {
                            headingLines.push(currentLine)
                        }

                        headingLines.forEach((line) => {
                            notesPage.drawText(line, {
                                x: 50,
                                y: currentY,
                                size: headingFontSize,
                                font,
                                color: rgb(0.1, 0.1, 0.1),
                            })

                            currentY -= 14
                        })

                        currentY -= 4

                        notesPage.drawText(
                            highlight.note || '',
                            {
                                x: 65,
                                y: currentY,
                                size: 9,
                                font,
                                color: rgb(0.2, 0.2, 0.2),
                            }
                        )

                        currentY -= 28
                    }
                )
            }

            // Save after everything has been added.
            const modifiedPdfBytes = await pdfDoc.save({
                useObjectStreams: false,
            })

            const pdfBuffer = new ArrayBuffer(
                modifiedPdfBytes.byteLength
            )

            new Uint8Array(pdfBuffer).set(modifiedPdfBytes)

            const blob = new Blob([pdfBuffer], {
                type: 'application/pdf',
            })

            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')

            const originalName =
                pdfFileName || 'document.pdf'

            const baseName =
                originalName.toLowerCase().endsWith('.pdf')
                    ? originalName.slice(0, -4)
                    : originalName

            link.href = url
            link.download = `${baseName}-highlighted.pdf`

            document.body.appendChild(link)
            link.click()
            link.remove()

            setTimeout(() => {
                URL.revokeObjectURL(url)
            }, 1000)
        } catch (error) {
            console.error(
                'Failed to export highlighted PDF:',
                error
            )
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
                    This will download the original PDF with your
                    saved highlights and notes added.
                </p>

                {highlights.length === 0 && (
                    <p>
                        No saved highlights or notes for this
                        document.
                    </p>
                )}

                <div
                    style={{
                        display: 'flex',
                        gap: '10px',
                        marginTop: '20px',
                    }}
                >
                    <button
                        onClick={handleDownloadPdf}
                        disabled={
                            !pdfUrl ||
                            highlights.length === 0
                        }
                    >
                        Download PDF
                    </button>

                    <button onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}