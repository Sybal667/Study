import { useRef, useState } from 'react'

export function useHoverPanels() {
  const [showNav, setShowNav] = useState(false)
  const [showPdfControls, setShowPdfControls] = useState(false)
  const navTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pdfControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const openNav = () => {
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current)
      navTimeoutRef.current = null
    }
    setShowNav(true)
  }

  const closeNavDelayed = () => {
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current)
    }
    navTimeoutRef.current = setTimeout(() => {
      setShowNav(false)
    }, 500)
  }

  const openPdfControls = () => {
    if (pdfControlsTimeoutRef.current) {
      clearTimeout(pdfControlsTimeoutRef.current)
      pdfControlsTimeoutRef.current = null
    }
    setShowPdfControls(true)
  }

  const closePdfControlsDelayed = () => {
    if (pdfControlsTimeoutRef.current) {
      clearTimeout(pdfControlsTimeoutRef.current)
    }
    pdfControlsTimeoutRef.current = setTimeout(() => {
      setShowPdfControls(false)
    }, 500)
  }

  return {
    showNav,
    showPdfControls,
    openNav,
    closeNavDelayed,
    openPdfControls,
    closePdfControlsDelayed,
  }
}
