'use client'

import { useState } from 'react'
import { PendingHighlight } from '@/hooks/useHighlightSelection'

interface HighlightNotePopupProps {
  pending: PendingHighlight
  onSave: (note: string) => void
  onCancel: () => void
}

export default function HighlightNotePopup({ pending, onSave, onCancel }: HighlightNotePopupProps) {
  const [note, setNote] = useState('')

  return (
    <div
      style={{
        position: 'fixed',
        left: pending.popupX,
        top: pending.popupY,
        zIndex: 1000,
        width: 260,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 }}>
        Add a note (optional)
      </div>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Type something..."
        style={{
          width: '100%',
          minHeight: 60,
          resize: 'vertical',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          padding: 6,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(note)}
          style={{
            background: 'rgba(76,175,80,0.25)',
            border: '1px solid rgba(76,175,80,0.6)',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          {note.trim() ? 'Save note' : 'Just highlight'}
        </button>
      </div>
    </div>
  )
}