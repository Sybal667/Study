import { useEffect, useRef, useState } from 'react'

export function useTimer() {
  const [minutes, setMinutes] = useState(25)
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [displayTime, setDisplayTime] = useState('25:00')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds((prevSeconds) => {
          if (prevSeconds === 0) {
            setMinutes((prevMinutes) => {
              if (prevMinutes === 0) {
                setIsRunning(false)
                return 0
              }
              return prevMinutes - 1
            })
            return 59
          }
          return prevSeconds - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRunning])

  useEffect(() => {
    const mins = String(minutes).padStart(2, '0')
    const secs = String(seconds).padStart(2, '0')
    setDisplayTime(`${mins}:${secs}`)
  }, [minutes, seconds])

  const handleTimerClick = () => {
    if (!isRunning) {
      setIsEditing(true)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  }

  const handleTimerInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (/^[0-9:]*$/.test(value)) {
      setDisplayTime(value)
    }
  }

  const handleTimerBlur = () => {
    setIsEditing(false)
    const parts = displayTime.split(':')
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0
      const secs = parseInt(parts[1]) || 0
      if (mins >= 0 && secs >= 0 && secs < 60) {
        setMinutes(mins)
        setSeconds(secs)
        setIsRunning(false)
        return
      }
    }
    setDisplayTime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
  }

  const handleTimerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTimerBlur()
    }
  }

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false)
    } else {
      if (minutes === 0 && seconds === 0) {
        setMinutes(25)
        setSeconds(0)
        setDisplayTime('25:00')
      }
      setIsRunning(true)
    }
  }

  const resetTimer = () => {
    setIsRunning(false)
    setMinutes(25)
    setSeconds(0)
    setDisplayTime('25:00')
  }

  return {
    minutes,
    seconds,
    isRunning,
    isEditing,
    displayTime,
    inputRef,
    handleTimerClick,
    handleTimerInput,
    handleTimerBlur,
    handleTimerKeyDown,
    toggleTimer,
    resetTimer,
  }
}
