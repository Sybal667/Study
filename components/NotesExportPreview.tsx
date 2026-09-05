'use client'

import { jsPDF } from 'jspdf'

interface Highlight {
    highlight_id: number
    page_number: number
    highlighted_text: string
    note: string | null
}

interface NotesExportPreviewProps {
    highlights: Highlight[]
    pdfFileName: string | undefined
    onClose: () => void
}

export default function NotesExportPreview({
    highlights,
    pdfFileName,
    onClose,
}: NotesExportPreviewProps) {

    const handleDownloadPdf = () => {
        const doc = new jsPDF()

        doc.setFontSize(18)
        doc.text('Notes Export', 20, 20)

        doc.setFontSize(12)
        doc.text(`Document: ${pdfFileName || 'Document.pdf'}`, 20, 30)

        let y = 45

        highlights.forEach((highlight) => {
            doc.setFontSize(13)
            doc.text(`Page ${highlight.page_number}`, 20, y)
            y += 8

            doc.setFontSize(11)

            const highlightLines = doc.splitTextToSize(
                highlight.highlighted_text,
                170
            )

            doc.text(highlightLines, 20, y)
            y += highlightLines.length * 6

            if (highlight.note) {
                y += 3

                const noteLines = doc.splitTextToSize(
                    `Note: ${highlight.note}`,
                    170
                )

                doc.text(noteLines, 20, y)
                y += noteLines.length * 6
            }

            y += 10

            if (y > 270) {
                doc.addPage()
                y = 20
            }
        })

        doc.save('study-notes.pdf')
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
                <h2>Notes Export Preview</h2>

                <p>
                    <strong>Document:</strong> {pdfFileName || 'Document.pdf'}
                </p>

                {highlights.length === 0 ? (
                    <p>No saved highlights or notes for this document.</p>
                ) : (
                    highlights.map((highlight) => (
                        <div key={highlight.highlight_id}>
                            <h3>Page {highlight.page_number}</h3>

                            <p>{highlight.highlighted_text}</p>

                            {highlight.note && (
                                <p>
                                    <strong>Note:</strong> {highlight.note}
                                </p>
                            )}

                            <hr />
                        </div>
                    ))
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button onClick={handleDownloadPdf}>
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