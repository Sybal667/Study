'use client'

interface NotesExportPreviewProps {
    onClose: () => void
}

export default function NotesExportPreview({
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

                <p>Your saved highlights and notes will appear here.</p>

                <button onClick={onClose}>Close</button>
            </div>
        </div>
    )
}