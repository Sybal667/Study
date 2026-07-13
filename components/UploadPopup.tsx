'use client'

import { navButtonStyle } from '@/lib/studyStyles'

interface UploadPopupProps {
  onClose: () => void
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  studentNumber: number | null
}

export default function UploadPopup({ onClose, onFileSelected, studentNumber }: UploadPopupProps) {
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
          backgroundColor: 'rgba(0,0,0,0.9)',
          padding: '24px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.2)',
          minWidth: '300px',
        }}
      >
        <h3 style={{ color: 'white' }}>Import PDF</h3>

        <label style={navButtonStyle}>
          📁 Upload from device
          <input
            type="file"
            accept=".pdf"
            onChange={async (e) => {
              onClose()
              await onFileSelected(e)
            }}
            style={{ display: 'none' }}
          />
        </label>

        <button
          style={{ ...navButtonStyle, marginTop: '10px' }}
          onClick={() => {
            const moduleCode = window.location.pathname.split('/').pop()
            if (!studentNumber || !moduleCode) return
            window.location.href = `/api/drive/authorize?student_number=${studentNumber}&module_code=${moduleCode}`
          }}
        >
          ☁️ Import from drive
        </button>

        <button style={{ ...navButtonStyle, marginTop: '20px' }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
