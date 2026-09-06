import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

  const generateThumbnails = async (pdf: any) => {
    const thumbs: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 0.2 })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvasContext: ctx!,
        viewport,
      }).promise

      thumbs.push(canvas.toDataURL())
    }

    setPageThumbnails(thumbs)
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

  useEffect(() => {
    if (!showThumbnails) return
    if (!sidebarRef.current) return

    const el = sidebarRef.current

    const itemHeight = 120 
    el.scrollTop = (currentPage - 1) * itemHeight
  }, [showThumbnails, currentPage])

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

  useEffect(() => {
    const container = pdfContainerRef.current
    if (!container || !numPages) return

    const handleScroll = () => {
      const container = pdfContainerRef.current
      if (!container) return

      const scrollTop = container.scrollTop

      const pageHeight = container.scrollHeight / numPages

      let page = 1

      for (let i = 0; i < numPages; i++) {
        const pageStart = i * pageHeight
        const pageEnd = pageStart + pageHeight

        if (scrollTop >= pageStart && scrollTop < pageEnd) {
          page = i + 1
          break
        }
      }

      if (page !== currentPageRef.current) {
        currentPageRef.current = page
        setCurrentPage(page)
        updatePage(page)
      }
    }

    container.addEventListener('scroll', handleScroll)

    return () => {
      container.removeEventListener('scroll', handleScroll)
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
    const loadPdfWorker = async () => {
      const { pdfjs } = await import('react-pdf')
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    }
    loadPdfWorker()
  }, [])

  useEffect(() => {
    if (!pdfReady) return
    if (!pdfContainerRef.current) return

    const container = pdfContainerRef.current

    const scrollValue = Number(0) //will set this later in the next commmit

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight * scrollValue
    })
  }, [pdfReady])

  useEffect(() => {
    if (!pdfUrl || !pdfContainerRef.current) return

    const container = pdfContainerRef.current

    const fitPdfToScreen = () => {
      const containerWidth = container.clientWidth - 20
      const baseWidth = 595
      const newScale = containerWidth / baseWidth
      setScale(newScale)
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
    const containerWidth = container.clientWidth - 20
    const baseWidth = 595
    const newScale = containerWidth / baseWidth
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

    const scrollValue = el.scrollTop / (el.scrollHeight - el.clientHeight)

    scrollSaveRef.current = scrollValue
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      saveScrollToDB(scrollSaveRef.current)
    }, 1500)

    console.log('SCROLL VALUE:', scrollSaveRef.current)
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

    console.log('PDF STATE LOAD:', { data, error })

    if (!error && data) {
      console.log('Zoom from DB:', data.zoom_level)
      console.log('Scroll from DB:', data.scroll_position)
      console.log('Last page from DB:', data.last_page)

    
      if (data.zoom_level) {
        setScale(Number(data.zoom_level))
      }
      setRotation(Number(data.rotation || 0))
      setTimeout(() => {
        const container = pdfContainerRef.current
        console.log('PDF container:', container)

        if (container) {
          const scrollValue = Number(data.scroll_position || 0)

          container.scrollTop = (container.scrollHeight - container.clientHeight) * scrollValue

          console.log('SCROLL APPLIED:', scrollValue)
        }
      }, 800)
    }

    if (!error && data) {
      if (data.zoom_level) {
        setScale(Number(data.zoom_level))
      }

      const waitForPdf = setInterval(() => {
        const container = pdfContainerRef.current

        if (container) {
          console.log('PDF ready → applying state')

          if (data.scroll_position) {
            container.scrollTop = container.scrollHeight * Number(data.scroll_position)

            console.log('Scroll applied:', container.scrollTop)
          }

          clearInterval(waitForPdf)
        } else {
          console.log('Waiting for PDF render...')
        }
      }, 200)
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
    rotatePage , 
    completeExternalImport,
  }
}