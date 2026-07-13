'use client'

import { useTimer } from '@/hooks/useTimer'
import {
  timerContainerStyle,
  getTimerTextStyle,
  getTimerButtonStyle,
  resetButtonStyle,
} from '@/lib/studyStyles'

export default function StudyTimer() {
  const {
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
  } = useTimer()

  return (
    <div style={timerContainerStyle}>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={displayTime}
          onChange={handleTimerInput}
          onBlur={handleTimerBlur}
          onKeyDown={handleTimerKeyDown}
          style={getTimerTextStyle(isRunning)}
          maxLength={5}
        />
      ) : (
        <span style={getTimerTextStyle(isRunning)} onClick={handleTimerClick}>
          {displayTime}
        </span>
      )}

      <button onClick={toggleTimer} style={getTimerButtonStyle(isRunning)}>
        {isRunning ? '⏸️' : '▶️'}
      </button>

      <button onClick={resetTimer} style={resetButtonStyle}>
        ↺
      </button>
    </div>
  )
}
