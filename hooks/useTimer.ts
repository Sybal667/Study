import { useEffect, useRef, useState } from 'react'

export type TimerField = 'h' | 'm' | 's'
export const TIMER_FIELDS: TimerField[] = ['h', 'm', 's']

const DEFAULT_SECONDS = 25 * 60
const MAX_SECONDS = 99 * 3600 + 59 * 60 + 59

// alarm: a short three-note chime, repeated for ~10 seconds
const ALARM_REPEATS = 7
const ALARM_GAP_MS = 1500
const CHIME_NOTES = [
  { freq: 880, at: 0 },
  { freq: 1108, at: 0.2 },
  { freq: 1318, at: 0.4 },
]

export function useTimer() {
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS) // single source of truth, in seconds
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SECONDS) // session length, for the progress ring
  const [isRunning, setIsRunning] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [activeField, setActiveField] = useState<TimerField | null>(null)
  const [draft, setDraft] = useState({ h: '00', m: '25', s: '00' })
  const [isRinging, setIsRinging] = useState(false)
  const inputRefs = useRef<Record<TimerField, HTMLInputElement | null>>({ h: null, m: null, s: null })
  const audioCtxRef = useRef<AudioContext | null>(null)
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  // countdown
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

  // Browsers only allow sound after a user action, so the audio engine is
  // created/woken up when the user presses start (see toggleTimer).
  const prepareAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new Ctx()
      }
      if (audioCtxRef.current.state === 'suspended') void audioCtxRef.current.resume()
    } catch {
      // no audio support - the timer still works, just silently
    }
  }

  const playChime = () => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const now = ctx.currentTime
    CHIME_NOTES.forEach(({ freq, at }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      // quick fade in, smooth fade out = soft bell-like tone, no clicks
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.28, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + at)
      osc.stop(now + at + 0.65)
    })
  }

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = null
    }
    setIsRinging(false)
  }

  const startAlarm = () => {
    stopAlarm()
    prepareAudio()
    setIsRinging(true)
    let count = 0
    playChime()
    count++
    alarmIntervalRef.current = setInterval(() => {
      if (count >= ALARM_REPEATS) {
        stopAlarm()
        return
      }
      playChime()
      count++
    }, ALARM_GAP_MS)
  }

  // at zero: stop the clock and ring the alarm
  useEffect(() => {
    if (isRunning && remaining === 0) {
      setIsRunning(false)
      startAlarm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, remaining])

  // clean up if the page is left while the alarm is ringing
  useEffect(() => {
    return () => {
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current)
      void audioCtxRef.current?.close()
    }
  }, [])

  const focusField = (field: TimerField) => {
    setActiveField(field)
    setTimeout(() => {
      inputRefs.current[field]?.focus()
      inputRefs.current[field]?.select()
    }, 0)
  }

  // click on hours / minutes / seconds
  const startEditing = (field: TimerField) => {
    if (isRunning) return
    if (!isEditing) {
      setDraft({ h: pad(hours), m: pad(minutes), s: pad(seconds) })
      setIsEditing(true)
    }
    focusField(field)
  }

  const handleFieldChange = (field: TimerField, raw: string) => {
    // typing ":" jumps to the next field
    if (raw.includes(':')) {
      const next = TIMER_FIELDS[TIMER_FIELDS.indexOf(field) + 1]
      if (next) focusField(next)
      return
    }
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    setDraft((d) => ({ ...d, [field]: digits }))
    // two digits typed -> move on automatically
    if (digits.length === 2) {
      const next = TIMER_FIELDS[TIMER_FIELDS.indexOf(field) + 1]
      if (next) focusField(next)
    }
  }

  const commitEdit = () => {
    const total =
      (parseInt(draft.h) || 0) * 3600 + (parseInt(draft.m) || 0) * 60 + (parseInt(draft.s) || 0)
    setIsEditing(false)
    setActiveField(null)
    if (total <= 0) return // ignore empty / zero, keep previous time
    const clamped = Math.min(total, MAX_SECONDS) // e.g. 90 minutes becomes 01:30:00
    setRemaining(clamped)
    setTotalSeconds(clamped)
    setIsRunning(false)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setActiveField(null)
  }

  const toggleTimer = () => {
    if (isRinging) {
      stopAlarm()
      return
    }
    prepareAudio() // user just clicked, so the browser allows sound later
    if (isRunning) {
      setIsRunning(false)
      return
    }
    if (isEditing) commitEdit()
    if (remaining === 0) {
      setRemaining(DEFAULT_SECONDS)
      setTotalSeconds(DEFAULT_SECONDS)
    }
    setIsRunning(true)
  }

  const resetTimer = () => {
    stopAlarm()
    setIsRunning(false)
    setIsEditing(false)
    setActiveField(null)
    setRemaining(DEFAULT_SECONDS)
    setTotalSeconds(DEFAULT_SECONDS)
  }

  return {
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
  }
}