'use client'

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface Highlight {
    highlight_id: number
    page_number: number
    highlighted_text: string
    note: string | null
}

interface NotesOnlyExportProps {
    highlights: Highlight[]
    pdfFileName: string | undefined
    onClose: () => void
}

export default function NotesOnlyExport({
    highlights,
    pdfFileName,
    onClose,
}: NotesOnlyExportProps) {
    const handleDownloadNotes = async () => {
        try {
            const pdfDoc = await PDFDocument.create()
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

            const wrapText = (text: string, size: number, maxWidth: number) => {
                const words = text.split(' ')
                const lines: string[] = []
                let line = ''

                for (const word of words) {
                    const test = line ? `${line} ${word}` : word

                    if (font.widthOfTextAtSize(test, size) > maxWidth) {
                        if (line) lines.push(line)
                        line = word
                    } else {
                        line = test
                    }
                }

                if (line) lines.push(line)
                return lines
            }

            let page = pdfDoc.addPage()
            const pageWidth = page.getSize().width
            const pageHeight = page.getSize().height
            const margin = 50
            const maxWidth = pageWidth - margin * 2
            const bottomMargin = 50

            let currentY = pageHeight - 60

            page.drawText('Study Notes', {
                x: margin,
                y: currentY,
                size: 20,
                font: boldFont,
                color: rgb(0.1, 0.1, 0.1),
            })

            currentY -= 28

            const documentName = pdfFileName || 'Document'

            page.drawText(`Document: ${documentName}`, {
                x: margin,
                y: currentY,
                size: 10,
                font,
                color: rgb(0.3, 0.3, 0.3),
            })

            currentY -= 35

            for (const highlight of highlights) {
                const cleanText = highlight.highlighted_text
                    .replace(/\s+/g, ' ')
                    .trim()

                const heading = `Page ${highlight.page_number}`
                const highlightLines = wrapText(cleanText, 11, maxWidth)
                const noteLines = highlight.note
                    ? wrapText(highlight.note, 10, maxWidth - 15)
                    : []

                const entryHeight =
                    18 +
                    highlightLines.length * 15 +
                    (noteLines.length > 0 ? 8 + noteLines.length * 14 : 0) +
                    22

                if (currentY - entryHeight < bottomMargin) {
                    page = pdfDoc.addPage()
                    currentY = page.getSize().height - 60
                }

                page.drawText(heading, {
                    x: margin,
                    y: currentY,
                    size: 10,
                    font: boldFont,
                    color: rgb(0.1, 0.35, 0.85),
                })

                currentY -= 18

                for (const line of highlightLines) {
                    page.drawText(line, {
                        x: margin,
                        y: currentY,
                        size: 11,
                        font,
                        color: rgb(0.1, 0.1, 0.1),
                    })

                    currentY -= 15
                }

                if (noteLines.length > 0) {
                    currentY -= 8

                    for (const line of noteLines) {
                        page.drawText(line, {
                            x: margin + 15,
                            y: currentY,
                            size: 10,
                            font,
                            color: rgb(0.3, 0.3, 0.3),
                        })

                        currentY -= 14
                    }
                }

                currentY -= 22
            }

            const pdfBytes = await pdfDoc.save({ useObjectStreams: false })

            const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength)
            new Uint8Array(pdfBuffer).set(pdfBytes)

            const blob = new Blob([pdfBuffer], {
                type: 'application/pdf',
            })

            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')

            const originalName = pdfFileName || 'document.pdf'
            const baseName = originalName.toLowerCase().endsWith('.pdf')
                ? originalName.slice(0, -4)
                : originalName

            link.href = url
            link.download = `${baseName}-notes.pdf`

            document.body.appendChild(link)
            link.click()
            link.remove()

            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (error) {
            console.error('Failed to export study notes:', error)
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
                    maxWidth: '700px',
                    backgroundColor: 'white',
                    color: 'black',
                    padding: '30px',
                    borderRadius: '12px',
                }}
            >
                <h2>Study Notes</h2>

                <p>
                    Download a study summary containing all saved highlights and notes
                    from this document.
                </p>

                {highlights.length === 0 && (
                    <p>No saved highlights or notes for this document.</p>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                        onClick={handleDownloadNotes}
                        disabled={highlights.length === 0}
                    >
                        Download Notes
                    </button>

                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}