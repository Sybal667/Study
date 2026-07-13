'use client'

import { useEffect, useState } from 'react'
import { navButtonStyle } from '@/lib/studyStyles'

interface DriveFile {
  id: string
  name: string
  size?: string
  modifiedTime?: string
  thumbnailLink?: string
}

interface DriveFileBrowserProps {
  studentNumber: number
  onClose: () => void
  onFileSelected: (file: DriveFile) => void
}

export default function DriveFileBrowser({ studentNumber, onClose, onFileSelected }: DriveFileBrowserProps) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/drive/files?student_number=${studentNumber}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to load Drive files')
          return
        }

        setFiles(data.files || [])
      } catch (err) {
        console.error('Failed to fetch Drive files:', err)
        setError('Something went wrong loading your Drive files')
      } finally {
        setLoading(false)
      }
    }

    loadFiles()
  }, [studentNumber])

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
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.92)',
          padding: '24px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.2)',
          minWidth: '420px',
          maxWidth: '520px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ color: 'white', margin: 0 }}>📁 Your Drive PDFs</h3>
          <button onClick={onClose} style={{ ...navButtonStyle, padding: '6px 14px', fontSize: '12px' }}>
            ✕ Close
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ color: 'white', opacity: 0.7 }}>Loading your files...</div>}

          {error && <div style={{ color: '#ff6b6b' }}>{error}</div>}

          {!loading && !error && files.length === 0 && (
            <div style={{ color: 'white', opacity: 0.7 }}>No PDFs found in your Drive.</div>
          )}

          {!loading &&
            !error &&
            files.map((file) => (
              <div
                key={file.id}
                onClick={() => onFileSelected(file)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '6px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              >
                {file.thumbnailLink ? (
                  <img src={file.thumbnailLink} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                ) : (
                  <div style={{ fontSize: '24px' }}>📄</div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.name}
                  </div>
                  <div style={{ color: 'white', opacity: 0.5, fontSize: '11px' }}>
                    {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}