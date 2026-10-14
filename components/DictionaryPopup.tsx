'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { DictionaryEntry } from '@/lib/dictionary'

interface DictionaryPopupProps {
  selection: {
    word: string
    x: number
    y: number
  }
  onClose: () => void
}

type LookupState =
  | { status: 'loading' }
  | { status: 'found'; entry: DictionaryEntry; lookedUp: string }
  | { status: 'missing' }
  | { status: 'unavailable' }

const SOURCE_LABELS: Record<DictionaryEntry['source'], string> = {
  wiktionary: 'Wiktionary',
  freedictionary: 'Free Dictionary',
  datamuse: 'WordNet via Datamuse',
}

const clientCache = new Map<string, LookupState>()
const CLIENT_TIMEOUT_MS = 12000

export default function DictionaryPopup({ selection, onClose }: DictionaryPopupProps) {
  const [state, setState] = useState<LookupState>({ status: 'loading' })
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const key = selection.word.trim().toLowerCase()
    const cached = clientCache.get(key)

    if (cached) {
      setState(cached)
      return
    }

    setState({ status: 'loading' })

    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)

    const run = async () => {
      try {
        const response = await fetch(`/api/dictionary?word=${encodeURIComponent(selection.word)}`, {
          signal: controller.signal,
        })

        if (cancelled) return

        if (!response.ok) {
          setState({ status: 'unavailable' })
          return
        }

        const data = await response.json()
        if (cancelled) return

        const next: LookupState =
          data.found && data.entry
            ? { status: 'found', entry: data.entry, lookedUp: data.lookedUp ?? data.entry.word }
            : { status: 'missing' }

        clientCache.set(key, next)
        setState(next)
      } catch {
        if (!cancelled) setState({ status: 'unavailable' })
      }
    }

    run()

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [selection.word])

  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(selection.x, window.innerWidth - 350)),
    top: Math.min(selection.y + 20, window.innerHeight - 350),
    maxWidth: '320px',
    maxHeight: '300px',
    overflowY: 'auto',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    padding: '14px 18px',
    zIndex: 9999,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    color: '#e8e8e8',
    fontSize: '14px',
    lineHeight: '1.5',
    pointerEvents: 'auto',
  }

  if (state.status !== 'found') {
    const message =
      state.status === 'loading'
        ? `Looking up “${selection.word.trim()}”…`
        : state.status === 'missing'
          ? `No definition found for “${selection.word.trim()}”`
          : 'Dictionary is unreachable right now'

    return (
      <div ref={popupRef} style={{ ...popupStyle, padding: '8px 14px', fontSize: '13px', opacity: 0.85 }}>
        {message}
      </div>
    )
  }

  const { entry, lookedUp } = state
  const showLookedUp = lookedUp.toLowerCase() !== selection.word.trim().toLowerCase()

  return (
    <div ref={popupRef} style={popupStyle}>
      <div style={{ fontWeight: 600, marginBottom: 2, color: '#fff' }}>
        {entry.word}
        {entry.phonetic && (
          <span style={{ fontWeight: 400, fontSize: '12px', color: '#888', marginLeft: 8 }}>{entry.phonetic}</span>
        )}
      </div>

      {showLookedUp && (
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 6 }}>
          Showing the definition of “{lookedUp}”
        </div>
      )}

      <div style={{ fontSize: '13px', color: '#d0d0d0', marginTop: 6 }}>
        {entry.meanings.slice(0, 3).map((meaning, idx) => (
          <div key={idx} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {meaning.partOfSpeech}
            </div>
            {meaning.definitions.slice(0, 2).map((def, defIdx) => (
              <div key={defIdx} style={{ marginTop: 2 }}>
                {meaning.definitions.length > 1 ? `${defIdx + 1}. ` : ''}
                {def.definition}
                {defIdx === 0 && def.example && (
                  <div style={{ color: '#888', fontSize: '12px', fontStyle: 'italic', marginTop: 2 }}>
                    “{def.example}”
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ fontSize: '10px', color: '#666', marginTop: 4 }}>Source: {SOURCE_LABELS[entry.source]}</div>
    </div>
  )
}
