'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { TourStage, TOUR_STEPS } from '@/lib/tourSteps'

const STORAGE_KEY = 'studyPageTourCompleted'

async function syncTourCompletionToBackend(studentNumber: string | number | null | undefined) {
  if (!studentNumber) return
  try {
    await fetch('/api/tour/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_number: studentNumber }),
    })
  } catch {
    // non-blocking
  }
}

export function useTour(opts: {
  studentNumber: string | number | null | undefined
  pdfUrl: string | null | undefined
  aiSidebarOpen: boolean
  uploading?: boolean
}) {
  const { studentNumber, pdfUrl, uploading } = opts

  const [stage, setStage] = useState<TourStage>('done')
  const [stepIndex, setStepIndex] = useState(0)
  const initialized = useRef(false)

  // Decide once, on mount, whether to start the tour and where
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const seenLocally =
      typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true'
    if (seenLocally) return

    setStage(pdfUrl ? 'pdf' : 'upload')
    setStepIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

// Auto-advance out of a blocking step once its real-world condition is met
  useEffect(() => {
    if (stage !== 'upload') return
    const current = TOUR_STEPS.upload[stepIndex]
    if (current?.blocking && (pdfUrl || uploading)) {
      setStage('pdf')
      setStepIndex(0)
    }
  }, [stage, stepIndex, pdfUrl, uploading])

const complete = useCallback(() => {
    setStage('done')
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    }
    syncTourCompletionToBackend(studentNumber)
  }, [studentNumber])

  // Called directly by upload-trigger buttons, so the tooltip disappears
  // the instant the user clicks — not when the upload finishes.
  const dismissBlockingStep = useCallback(() => {
    if (stage !== 'upload') return
    const current = TOUR_STEPS.upload[stepIndex]
    if (!current?.blocking) return
    setStage('pdf')
    setStepIndex(0)
  }, [stage, stepIndex])

  const next = useCallback(() => {
    if (stage === 'done') return
    const steps = TOUR_STEPS[stage]
    const current = steps[stepIndex]
    if (current?.blocking) return // can only advance by satisfying the block, not by clicking Next

    if (stepIndex + 1 < steps.length) {
      setStepIndex((i) => i + 1)
      return
    }

    if (stage === 'pdf') {
      complete()
    }
  }, [stage, stepIndex, complete])

  const skip = useCallback(() => {
    const steps = stage === 'done' ? [] : TOUR_STEPS[stage]
    const current = steps[stepIndex]
    if (current?.blocking) return // cannot skip past a blocking step
    complete()
  }, [stage, stepIndex, complete])

  const activeStep = stage === 'done' ? null : TOUR_STEPS[stage][stepIndex]
  const isLastStep = stage !== 'done' ? stepIndex === TOUR_STEPS[stage].length - 1 : false

return {
    stage,
    activeStep,
    isLastStep,
    next,
    skip,
    dismissBlockingStep,
    isActive: !!activeStep,
    forceNavOpen: activeStep?.requiresPanel === 'nav',
    forcePdfControlsOpen: activeStep?.requiresPanel === 'pdfControls',
    forceImportOpen: !!activeStep?.forceImportDropdown,
  }
}