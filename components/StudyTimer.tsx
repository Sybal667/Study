'use client'

import { useState } from 'react'
import { useTimer, TIMER_FIELDS, TimerField } from '@/hooks/useTimer'

const MONO = 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const ACCENT = '#9db8ff' // soft periwinkle: calm, readable on the dark glass
const ALERT = '#ffb86b' // warm orange while the alarm rings

const RING_SIZE = 30
const RING_STROKE = 2.5
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_C = 2 * Math.PI * RING_R

function IconButton({
  onClick,
  label,
  primary,
  children,
}: {
  onClick: () => void
  label: string
  primary?: boolean
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32,
        height: 32,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        border: primary ? 'none' : '1px solid transparent',
        cursor: 'pointer',
        color: primary ? '#0f1117' : hover ? '#fff' : 'rgba(255,255,255,0.55)',
        background: primary
          ? hover ? '#fff' : 'rgba(255,255,255,0.9)'
          : hover ? 'rgba(255,255,255,0.1)' : 'transparent',
        transition: 'background 0.15s, color 0.15s',
        padding: 0,
      }}
    >
      {children}
    </button>
  )
}

export default function StudyTimer() {
  const {
    hours,
    minutes,
    seconds,
    remaining,
    totalSeconds,
    isRunning,
    isEditing,
    isRinging,
    activeField,
    draft,
    inputRefs,
    startEditing,
    handleFieldChange,
    commitEdit,
    cancelEdit,
    toggleTimer,
    resetTimer,
  } = useTimer()

  const progress = Math.min(Math.max(remaining / totalSeconds, 0), 1)

  const pad = (n: number) => String(n).padStart(2, '0')
  const values: Record<TimerField, string> = { h: pad(hours), m: pad(minutes), s: pad(seconds) }
  const labels: Record<TimerField, string> = { h: 'hr', m: 'min', s: 'sec' }
  const fullName: Record<TimerField, string> = { h: 'hours', m: 'minutes', s: 'seconds' }

  const digitStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: MONO,
    fontSize: 22,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
    color: isRinging ? ALERT : active ? '#fff' : isRunning ? '#fff' : 'rgba(255,255,255,0.78)',
    width: 34,
    textAlign: 'center',
    background: active ? 'rgba(157,184,255,0.16)' : 'transparent',
    border: 'none',
    borderRadius: 8,
    boxShadow: active ? `inset 0 -2px 0 ${ACCENT}` : 'none',
    outline: 'none',
    padding: '2px 0',
    cursor: isRunning ? 'default' : 'text',
    transition: 'background 0.15s, box-shadow 0.15s, color 0.15s',
  })

  const labelStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 1,
    color: active ? ACCENT : 'rgba(255,255,255,0.32)',
    transition: 'color 0.15s',
    userSelect: 'none',
  })

  const colon = (
    <span style={{ fontFamily: MONO, fontSize: 20, color: 'rgba(255,255,255,0.35)', paddingBottom: 12 }}>:</span>
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '7px 10px 7px 14px',
        margin: '0 auto',
        width: 'fit-content',
        background: 'rgba(14, 16, 22, 0.58)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
        position: 'relative',
        zIndex: 102,
        pointerEvents: 'auto',
        animation: isRinging ? 'studyTimerRing 1s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`@keyframes studyTimerRing {
        0%, 100% { box-shadow: 0 8px 28px rgba(0,0,0,0.28), 0 0 0 0 rgba(255,184,107,0.0); }
        50% { box-shadow: 0 8px 28px rgba(0,0,0,0.28), 0 0 0 6px rgba(255,184,107,0.28); }
      }`}</style>

      {/* progress ring */}
      <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={RING_STROKE} />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke={isRinging ? ALERT : isRunning ? ACCENT : 'rgba(255,255,255,0.4)'}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.2s' }}
        />
      </svg>

      {/* hours : minutes : seconds */}
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}
        onBlur={(e) => {
          // only finish editing when focus leaves all three fields
          if (isEditing && !e.currentTarget.contains(e.relatedTarget as Node | null)) commitEdit()
        }}
      >
        {TIMER_FIELDS.map((f, i) => {
          const active = isEditing && activeField === f
          return (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
              {i > 0 && colon}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {isEditing ? (
                  <input
                    ref={(el) => {
                      inputRefs.current[f] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    value={draft[f]}
                    onChange={(e) => handleFieldChange(f, e.target.value)}
                    onFocus={(e) => {
                      e.target.select()
                      startEditing(f)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    style={digitStyle(active)}
                    maxLength={3}
                    aria-label={`Set ${fullName[f]}`}
                  />
                ) : (
                  <span
                    style={digitStyle(false)}
                    onClick={() => startEditing(f)}
                    title={isRunning ? undefined : `Click to set ${fullName[f]}`}
                  >
                    {values[f]}
                  </span>
                )}
                <span style={labelStyle(active)}>{labels[f]}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton
          onClick={toggleTimer}
          label={isRinging ? 'Stop alarm' : isRunning ? 'Pause' : 'Start'}
          primary
        >
          {isRinging ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="2" y="2" width="8" height="8" rx="1.5" />
            </svg>
          ) : isRunning ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="2" y="1.5" width="3" height="9" rx="1" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.7-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5z" />
            </svg>
          )}
        </IconButton>
        <IconButton onClick={resetTimer} label="Reset">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.07" />
            <path d="M2.5 2.5v3h3" />
          </svg>
        </IconButton>
      </div>
    </div>
  )
}