'use client'

import { PendingHighlight } from '@/hooks/useHighlightSelection'

interface SaveToNotePopupProps {
  pending: PendingHighlight
  onSave: () => void
  onDismiss: () => void
}

export default function SaveToNotePopup({ pending, onSave, onDismiss }: SaveToNotePopupProps) {
  return (
    <div
      style={{
        position: 'fixed',
        left: pending.popupX,
        top: pending.popupY,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '8px 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <button
        onClick={onSave}
        style={{
          background: 'rgba(76,175,80,0.25)',
          border: '1px solid rgba(76,175,80,0.6)',
          borderRadius: 6,
          color: '#fff',
          fontSize: 12,
          padding: '4px 10px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        📝 Save to note
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 14,
          cursor: 'pointer',
          padding: '4px 6px',
        }}
      >
        ✕
      </button>
    </div>
  )
}