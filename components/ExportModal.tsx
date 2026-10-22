'use client'

import { ReactNode, useEffect } from 'react'
import { X, Highlighter, StickyNote, FileText } from 'lucide-react'

interface ExportModalProps {
  icon: ReactNode
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}

// Shared shell for the Export and Notes popups so they look like the rest of the app:
// dark glass card, soft borders, blue primary button and the green highlight accent.
export function ExportModal({ icon, title, subtitle, onClose, children, footer }: ExportModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="em-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="em-card">
        <div className="em-header">
          <div className="em-icon">{icon}</div>
          <div className="em-heading">
            <div className="em-title">{title}</div>
            {subtitle && <div className="em-subtitle">{subtitle}</div>}
          </div>
          <button className="em-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="em-body">{children}</div>

        <div className="em-footer">{footer}</div>
      </div>

      <style jsx global>{`
        .em-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(6px);
          animation: em-fade 0.18s ease-out;
        }
        .em-card {
          width: 100%;
          max-width: 560px;
          max-height: 86vh;
          display: flex;
          flex-direction: column;
          color: #fff;
          background: rgba(12, 12, 14, 0.92);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.65);
          animation: em-pop 0.2s ease-out;
        }
        .em-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 16px 14px 20px;
        }
        .em-icon {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          color: #fff;
          background: rgba(30, 58, 138, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .em-heading {
          flex: 1;
          min-width: 0;
        }
        .em-title {
          font-size: 18px;
          font-weight: 700;
        }
        .em-subtitle {
          margin-top: 2px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .em-close {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: rgba(255, 255, 255, 0.65);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .em-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .em-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0 20px 6px;
          scrollbar-width: thin;
        }
        .em-desc {
          margin: 0 0 14px;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.72);
        }
        .em-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          padding: 14px 20px 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 10px;
        }

        /* summary chips */
        .em-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }
        .em-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        /* preview list */
        .em-list-label {
          margin: 4px 0 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
        }
        .em-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 260px;
          overflow-y: auto;
          padding-right: 4px;
          scrollbar-width: thin;
        }
        .em-item {
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-left: 3px solid #4caf50;
        }
        .em-item-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .em-page {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(30, 58, 138, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .em-text {
          font-size: 13px;
          line-height: 1.45;
          color: #fff;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .em-note {
          margin-top: 8px;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.06);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          white-space: pre-wrap;
        }
        .em-more {
          text-align: center;
          padding: 4px 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* empty state */
        .em-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 28px 16px;
          text-align: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.18);
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          line-height: 1.5;
        }
        .em-empty strong {
          color: #fff;
          font-size: 14px;
        }

        /* notices */
        .em-notice {
          margin-top: 12px;
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 12px;
        }
        .em-notice.error {
          color: #ffb4b4;
          background: rgba(255, 107, 107, 0.12);
          border: 1px solid rgba(255, 107, 107, 0.35);
        }
        .em-notice.success {
          color: #b7e4b9;
          background: rgba(76, 175, 80, 0.14);
          border: 1px solid rgba(76, 175, 80, 0.4);
        }

        /* buttons */
        .em-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          transition: background 0.15s, transform 0.1s, opacity 0.15s;
        }
        .em-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }
        .em-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .em-btn.primary {
          background: rgba(30, 58, 138, 0.95);
          border-color: rgba(255, 255, 255, 0.28);
        }
        .em-btn.primary:hover:not(:disabled) {
          background: rgba(40, 76, 170, 1);
        }
        .em-btn.done {
          background: #2e7d32;
          border-color: rgba(255, 255, 255, 0.25);
        }
        .em-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .em-spinner {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          animation: em-spin 0.7s linear infinite;
        }

        @keyframes em-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes em-pop {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes em-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export function ModalButton({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  loading,
  done,
  icon,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'ghost'
  disabled?: boolean
  loading?: boolean
  done?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      className={`em-btn ${variant === 'primary' ? 'primary' : ''} ${done ? 'done' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <span className="em-spinner" /> : icon}
      {children}
    </button>
  )
}

interface PreviewHighlight {
  highlight_id: number
  page_number: number
  highlighted_text: string
  note: string | null
}

export function Notice({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return <div className={`em-notice ${kind}`}>{children}</div>
}

export function HighlightSummary({ highlights }: { highlights: PreviewHighlight[] }) {
  const notes = highlights.filter((h) => h.note).length
  const pages = new Set(highlights.map((h) => h.page_number)).size

  return (
    <div className="em-chips">
      <span className="em-chip">
        <Highlighter size={13} color="#4caf50" />
        {highlights.length} {highlights.length === 1 ? 'highlight' : 'highlights'}
      </span>
      <span className="em-chip">
        <StickyNote size={13} color="#7fa6ff" />
        {notes} {notes === 1 ? 'note' : 'notes'}
      </span>
      <span className="em-chip">
        <FileText size={13} color="#b3b3b3" />
        {pages} {pages === 1 ? 'page' : 'pages'}
      </span>
    </div>
  )
}

export function HighlightPreview({ highlights }: { highlights: PreviewHighlight[] }) {
  const LIMIT = 100
  const shown = highlights.slice(0, LIMIT)

  return (
    <>
      <div className="em-list-label">Preview</div>
      <div className="em-list">
        {shown.map((h) => (
          <div key={h.highlight_id} className="em-item">
            <div className="em-item-top">
              <span className="em-page">Page {h.page_number}</span>
            </div>
            <div className="em-text">{h.highlighted_text.replace(/\s+/g, ' ').trim()}</div>
            {h.note && <div className="em-note">{h.note}</div>}
          </div>
        ))}
        {highlights.length > LIMIT && <div className="em-more">+ {highlights.length - LIMIT} more in the download</div>}
      </div>
    </>
  )
}

export function EmptyHighlights() {
  return (
    <div className="em-empty">
      <Highlighter size={26} color="#4caf50" />
      <strong>No highlights yet</strong>
      <span>Highlight text in the PDF and add notes. They will show up here, ready to download.</span>
    </div>
  )
}
