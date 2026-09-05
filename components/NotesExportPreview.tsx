'use client'

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

                <button onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    )
}