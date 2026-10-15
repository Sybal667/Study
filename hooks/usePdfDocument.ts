import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Every thumbnail slot in the sidebar has this fixed height (see ThumbnailSidebar).
export const THUMB_ITEM_HEIGHT = 316
// Space above the first thumbnail (sidebar padding + "Pages" title).
const THUMB_HEADER_OFFSET = 42
// Longest side of a generated thumbnail image, in pixels.
const THUMB_MAX_SIDE = 360
// Highest zoom that "fit to screen" may produce on very wide screens.
const MAX_FIT_SCALE = 3

const computeFitScale = (container: HTMLElement) => {
  const containerWidth = container.clientWidth - 20
  const baseWidth = 595
  return Math.min(Math.max(containerWidth / baseWidth, 0.2), MAX_FIT_SCALE)
}

export function usePdfDocument(
  studentNumber: number | null,
  moduleId: number | null,
  onUploaded: () => Promise<void> | void
) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfId, setPdfId] = useState<number | null>(null)

  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [pdfReady, setPdfReady] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [pageThumbnails, setPageThumbnails] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const currentPageRef = useRef<number>(1)
  const scrollSaveRef = useRef<number>(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasRestoredRef = useRef(false)

  // Lazy thumbnail state
  const pdfProxyRef = useRef<any>(null)
  const thumbUrlsRef = useRef<Map<number, string>>(new Map())
  const thumbPendingRef = useRef<Set<number>>(new Set())
  const thumbChainRef = useRef<Promise<void>>(Promise.resolve())
  const thumbGenerationRef = useRef(0)

  const saveScrollToDB = async (value: number) => {
    if (!moduleId || !studentNumber) return
    if (!pdfUrl) return

    const { error } = await supabase
      .from('student_pdfs')
      .update({
        scroll_position: value,
        last_opened_at: new Date().toISOString(),
      })
      .eq('file_url', pdfUrl)

    if (error) {
      console.error('Failed to save scroll:', error)
    }
  }

  // Called when a PDF finishes loading. It no longer renders every page up front:
  // it only remembers the document and clears old thumbnails. Thumbnails are
  // created on demand while the sidebar is open (see the effect below).
  const generateThumbnails = async (pdf: any) => {
    thumbGenerationRef.current += 1
    thumbUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    thumbUrlsRef.current.clear()
    thumbPendingRef.current.clear()
    pdfProxyRef.current = pdf
    setPageThumbnails(new Array(pdf.numPages).fill(''))
  }

  const queueThumbnail = (index: number, isCancelled: () => boolean) => {
    if (thumbUrlsRef.current.has(index) || thumbPendingRef.current.has(index)) return

    const generation = thumbGenerationRef.current
    thumbPendingRef.current.add(index)

    // One thumbnail at a time, so the page stays responsive.
    thumbChainRef.current = thumbChainRef.current.then(async () => {
      try {
        if (isCancelled() || generation !== thumbGenerationRef.current) return
        const pdf = pdfProxyRef.current
        if (!pdf) return

        const page = await pdf.getPage(index)
        const base = page.getViewport({ scale: 1 })
        const thumbScale = THUMB_MAX_SIDE / Math.max(base.width, base.height)
        const viewport = page.getViewport({ scale: thumbScale })

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: ctx, viewport }).promise

        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))

        // Free the memory used by the temporary canvas and page.
        canvas.width = 0
        canvas.height = 0
        page.cleanup()

        if (!blob) return

        const url = URL.createObjectURL(blob)

        // The student may have opened another document while this was rendering.
        if (generation !== thumbGenerationRef.current) {
          URL.revokeObjectURL(url)
          return
        }

        thumbUrlsRef.current.set(index, url)
        setPageThumbnails((prev) => {
          const next = prev.slice()
          next[index - 1] = url
          return next
        })
      } catch (err) {
        console.error(`Failed to create thumbnail for page ${index}:`, err)
      } finally {
        thumbPendingRef.current.delete(index)
        // Let the browser breathe between thumbnails.
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    })
  }

  const savePageToDB = async (page: number) => {
    if (!pdfUrl) return

    await supabase
      .from('student_pdfs')
      .update({
        last_page: page,
        last_opened_at: new Date().toISOString(),
      })
      .eq('file_url', pdfUrl)
  }

  const saveZoomToDB = async (value: number) => {
    if (!moduleId || !studentNumber) return
    if (!pdfUrl) return

    await supabase
      .from('student_pdfs')
      .update({
        zoom_level: value,
        last_opened_at: new Date().toISOString(),
      })
      .eq('file_url', pdfUrl)
  }

  const saveRotationToDB = async (value: number) => {
    if (!moduleId || !studentNumber) return
    if (!pdfUrl) return

    await supabase
      .from('student_pdfs')
      .update({
        rotation: value,
        last_opened_at: new Date().toISOString(),
      })
      .eq('file_url', pdfUrl)
  }

  const rotatePage = () => {
    setRotation((prev) => {
      const newRotation = (prev + 90) % 360
      saveRotationToDB(newRotation)
      return newRotation
    })
  }

  const restorePdfState = async () => {
    if (!pdfContainerRef.current || !numPages || !pdfUrl) return

    const container = pdfContainerRef.current

    const { data } = await supabase
      .from('student_pdfs')
      .select('scroll_position, last_page, zoom_level, rotation')
      .eq('file_url', pdfUrl)
      .single()

    if (!data) return

    const dbScroll = Number(data.scroll_position || 0)
    const dbPage = Number(data.last_page || 1)
    const dbZoom = Number(data.zoom_level || 1)
    const dbRotation = Number(data.rotation || 0)

    //  zoom
    setScale(dbZoom)
    setRotation(dbRotation)

    // Wait for layout to fully recalc after zoom
    requestAnimationFrame(() => {
      setTimeout(() => {
        const pageHeight = container.scrollHeight / numPages

        //  jump to correct page first
        container.scrollTop = pageHeight * (dbPage - 1)

        // Fine-tune scroll AFTER page layout stabilizes
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const maxScroll = container.scrollHeight - container.clientHeight

            container.scrollTop = maxScroll * dbScroll
          })
        })
      }, 150)
    })
  }

  const goToPage = (page: number) => {
    const container = pdfContainerRef.current
    if (!container || !numPages) return
    const clamped = Math.max(1, Math.min(page, numPages))
    const pageHeight = container.scrollHeight / numPages
    container.scrollTop = pageHeight * (clamped - 1)
  }

  const updatePage = (page: number) => {
    if (pageTimeoutRef.current) {
      clearTimeout(pageTimeoutRef.current)
    }

    pageTimeoutRef.current = setTimeout(async () => {
      if (!pdfUrl) return

      await supabase
        .from('student_pdfs')
        .update({
          last_page: page,
          last_opened_at: new Date().toISOString(),
        })
        .eq('file_url', pdfUrl)
    }, 1200)
  }

  useEffect(() => {
    setCurrentPage(currentPageRef.current)
  }, [])

  // Sidebar open: jump to the current page, then create thumbnails only for the
  // slots that are on screen (plus a couple either side) as the student scrolls.
  useEffect(() => {
    if (!showThumbnails || !numPages) return
    const el = sidebarRef.current
    if (!el) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const requestVisible = () => {
      const first = Math.max(1, Math.floor((el.scrollTop - THUMB_HEADER_OFFSET) / THUMB_ITEM_HEIGHT) + 1 - 2)
      const last = Math.min(
        numPages,
        Math.ceil((el.scrollTop + el.clientHeight - THUMB_HEADER_OFFSET) / THUMB_ITEM_HEIGHT) + 2
      )
      for (let i = first; i <= last; i++) {
        queueThumbnail(i, () => cancelled)
      }
    }

    el.scrollTop = Math.max(0, (currentPageRef.current - 1) * THUMB_ITEM_HEIGHT)
    requestVisible()

    const onScroll = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(requestVisible, 80)
    }
    el.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      el.removeEventListener('scroll', onScroll)
    }
  }, [showThumbnails, numPages, pdfUrl])

  // Free thumbnail images when leaving the page.
  useEffect(() => {
    const urls = thumbUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.thumbnail-sidebar')) {
        setShowThumbnails(false)
      }
    }

    if (showThumbnails) {
      document.addEventListener('click', handleClick)
    }

    return () => document.removeEventListener('click', handleClick)
  }, [showThumbnails])

  // Work out the current page from the scroll position (one division per frame,
  // no loop over every page).
  useEffect(() => {
    const container = pdfContainerRef.current
    if (!container || !numPages) return

    let frame = 0

    const handleScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0

        const pageHeight = container.scrollHeight / numPages
        if (!pageHeight) return

        const page = Math.min(numPages, Math.max(1, Math.floor(container.scrollTop / pageHeight) + 1))

        if (page !== currentPageRef.current) {
          currentPageRef.current = page
          setCurrentPage(page)
          updatePage(page)
        }
      })
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [numPages, pdfUrl])

  useEffect(() => {
    hasRestoredRef.current = false
  }, [pdfUrl])

  useEffect(() => {
    if (!pdfUrl || !numPages) return
    if (hasRestoredRef.current) return

    hasRestoredRef.current = true
    restorePdfState()
  }, [pdfUrl, numPages])

  useEffect(() => {
    let cancelled = false
    const loadPdfWorker = async () => {
      try {
        const { pdfjs } = await import('react-pdf')
        if (cancelled) return
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      } catch (err) {
        console.error('Failed to load PDF worker:', err)
      }
    }
    loadPdfWorker()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!pdfReady) return
    if (!pdfContainerRef.current) return

    const container = pdfContainerRef.current

    const scrollValue = Number(0)

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight * scrollValue
    })
  }, [pdfReady])

  useEffect(() => {
    if (!pdfUrl || !pdfContainerRef.current) return

    const container = pdfContainerRef.current

    const fitPdfToScreen = () => {
      setScale(computeFitScale(container))
    }

    fitPdfToScreen()

    const observer = new ResizeObserver(() => {
      fitPdfToScreen()
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [pdfUrl])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setPdfFile(file)

    try {
      const fileName = `${Date.now()}_${file.name}`
      const { data, error } = await supabase.storage.from('pdfs').upload(`students/${fileName}`, file)

      if (error) {
        console.error('Upload error:', error)
        setUploading(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('pdfs').getPublicUrl(`students/${fileName}`)

      setPdfUrl(publicUrl)
      setUploading(false)

      const { data: insertedRow, error: insertErr } = await supabase
        .from('student_pdfs')
        .insert({
          student_number: studentNumber,
          module_id: moduleId,
          file_name: file.name,
          file_url: publicUrl,
        })
        .select('pdf_id')
        .single()

      if (insertErr) {
        console.error('Failed to save PDF record:', insertErr)
      } else if (insertedRow) {
        setPdfId(insertedRow.pdf_id)
      }

      await onUploaded()
    } catch (error) {
      console.error('Error uploading PDF:', error)
      setUploading(false)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setTimeout(() => {
      setPdfReady(true)
    }, 150)
  }

  const zoomIn = () => {
    setScale((prev) => {
      const newScale = Math.min(prev + 0.1, 4.0)
      saveZoomToDB(newScale)
      return newScale
    })
  }

  const zoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.1, 0.2)
      saveZoomToDB(newScale)
      return newScale
    })
  }

  const fitToScreen = () => {
    if (!pdfContainerRef.current) return

    const container = pdfContainerRef.current
    const newScale = computeFitScale(container)
    const maxScroll = container.scrollHeight - container.clientHeight
    const scrollFraction = maxScroll > 0 ? container.scrollTop / maxScroll : 0

    setScale(newScale)
    saveZoomToDB(newScale)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newMaxScroll = container.scrollHeight - container.clientHeight
        container.scrollTop = newMaxScroll * scrollFraction
      })
    })
  }

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget

    const scrollableHeight = el.scrollHeight - el.clientHeight
    if (scrollableHeight <= 0) return

    scrollSaveRef.current = el.scrollTop / scrollableHeight

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      saveScrollToDB(scrollSaveRef.current)
    }, 1500)
  }

  const openDocumentFromHistory = async (doc: any) => {
    setPdfUrl(doc.file_url)
    setPdfId(doc.pdf_id)
    setPdfFile({ name: doc.file_name } as File)

    const { data, error } = await supabase
      .from('student_pdfs')
      .select('last_page, zoom_level, scroll_position, rotation')
      .eq('pdf_id', doc.pdf_id)
      .single()

    if (!error && data) {
      if (data.zoom_level) {
        setScale(Number(data.zoom_level))
      }
      setRotation(Number(data.rotation || 0))
      setTimeout(() => {
        const container = pdfContainerRef.current

        if (container) {
          const scrollValue = Number(data.scroll_position || 0)

          container.scrollTop = (container.scrollHeight - container.clientHeight) * scrollValue
        }
      }, 800)
    }

    await supabase
      .from('student_pdfs')
      .update({ last_opened_at: new Date().toISOString() })
      .eq('pdf_id', doc.pdf_id)
  }

  const completeExternalImport = (publicUrl: string, fileName: string, newPdfId: number) => {
    setPdfUrl(publicUrl)
    setPdfId(newPdfId)
    setPdfFile({ name: fileName } as File)
  }

  return {
    pdfUrl,
    pdfFile,
    uploading,
    pdfId,
    numPages,
    scale,
    rotation,
    pdfReady,
    showThumbnails,
    setShowThumbnails,
    pageThumbnails,
    currentPage,
    pdfContainerRef,
    sidebarRef,
    handleFileUpload,
    onDocumentLoadSuccess,
    generateThumbnails,
    zoomIn,
    zoomOut,
    fitToScreen,
    handleContainerScroll,
    openDocumentFromHistory,
    savePageToDB,
    updatePage,
    goToPage,
    rotatePage,
    completeExternalImport,
  }
}
