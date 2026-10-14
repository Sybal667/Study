'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TourStage, TOUR_STEPS } from '@/lib/tourSteps'

// Per-account flag. The database (students.tour_completed_at) is the source of
// truth; localStorage is only a per-student safety net if the DB is unreachable.
const localKey = (studentNumber: string | number) => `studyTourSeen:${studentNumber}`

function readLocal(studentNumber: string | number): boolean {
  try {
    return window.localStorage.getItem(localKey(studentNumber)) === 'true'
  } catch {
    return false
  }
}

function writeLocal(studentNumber: string | number) {
  try {
    window.localStorage.setItem(localKey(studentNumber), 'true')
  } catch {
    // storage blocked (private mode etc.) - the DB flag still applies
  }
}

/** true = tour already seen, false = never seen, null = could not tell */
async function hasSeenTour(studentNumber: string | number): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('students')
    .select('tour_completed_at')
    .eq('student_number', studentNumber)
    .maybeSingle()

  if (error || !data) {
    console.error('Tour check failed:', error)
    return null
  }
  return data.tour_completed_at != null
}

async function markTourSeen(studentNumber: string | number) {
  writeLocal(studentNumber)
  const { error } = await supabase
    .from('students')
    .update({ tour_completed_at: new Date().toISOString() })
    .eq('student_number', studentNumber)
    .is('tour_completed_at', null) // never overwrite the original first-seen time
  if (error) console.error('Failed to save tour flag:', error)
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
  const decidedFor = useRef<string | number | null>(null)
  const pdfUrlRef = useRef(pdfUrl)
  pdfUrlRef.current = pdfUrl

  // Decide once per signed-in student, only after we know who they are.
  // Anything uncertain (no student yet, lookup failed) means NO tour.
  useEffect(() => {
    if (!studentNumber) return
    if (decidedFor.current === studentNumber) return
    decidedFor.current = studentNumber

    let cancelled = false
    ;(async () => {
      if (readLocal(studentNumber)) return // already seen on this browser

      const seen = await hasSeenTour(studentNumber)
      if (cancelled || seen !== false) return // seen before, or unknown -> stay quiet

      // First time: record it right away so a refresh or a second tab won't repeat it
      await markTourSeen(studentNumber)
      if (cancelled) return

      setStage(pdfUrlRef.current ? 'pdf' : 'upload')
      setStepIndex(0)
    })()

    return () => {
      cancelled = true
      // allow a re-run if the effect was torn down before it finished
      if (decidedFor.current === studentNumber) decidedFor.current = null
    }
  }, [studentNumber])

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
  }, [])

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