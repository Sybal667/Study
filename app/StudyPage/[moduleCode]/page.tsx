'use client'

import { useEffect, useState } from 'react'

import { useHoverPanels } from '@/hooks/useHoverPanels'
import { useStudentContext } from '@/hooks/useStudentContext'
import { usePdfDocument } from '@/hooks/usePdfDocument'
import StudyTimer from '@/components/StudyTimer'
import TopNavBar from '@/components/TopNavBar'
import PdfViewer from '@/components/PdfViewer'
import PdfControlsSidebar from '@/components/PdfControlsSidebar'
import ThumbnailSidebar from '@/components/ThumbnailSidebar'
import UploadPopup from '@/components/UploadPopup'
import AiSidebar from '@/components/AiSidebar'
import DriveFileBrowser from '@/components/DriveFileBrowser'
import { useTextSelectionLookup } from '@/hooks/useTextSelectionLookup';
import DictionaryPopup from '@/components/DictionaryPopup';
import { useHighlightSelection } from '@/hooks/useHighlightSelection'
import { useHighlights } from '@/hooks/useHighlights'
import HighlightNotePopup from '@/components/HighlightNotePopup'
import { useNoteSuggestion } from '@/hooks/useNoteSuggestion'
import SaveToNotePopup from '@/components/SaveToNotePopup'
import TourTooltip from '@/components/TourTooltip'
import { useTour } from '@/hooks/useTour'




import {
  containerStyle,
  topSectionStyle,
  getPdfContainerStyle,
  topHoverZoneStyle,
  leftHoverZoneStyle,
} from '@/lib/studyStyles'

const AI_SIDEBAR_DEFAULT_WIDTH = 420

export default function StudyPage() {
  const [selectedText] = useState('')
  const [showUploadPopup, setShowUploadPopup] = useState(false)
  const [showDriveBrowser, setShowDriveBrowser] = useState(false)
  const [driveImportingFile, setDriveImportingFile] = useState<string | null>(null)
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false)
  const [aiSidebarWidth, setAiSidebarWidth] = useState(AI_SIDEBAR_DEFAULT_WIDTH)
  const { showNav, showPdfControls, openNav, closeNavDelayed, openPdfControls, closePdfControlsDelayed } =  useHoverPanels()
  const { studentNumber, moduleId, documents, loadDocuments } = useStudentContext()


  const {
    pdfUrl,
    pdfFile,
    uploading,
    pdfId,
    numPages,
    scale,
    rotation,
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
    updatePage,
    goToPage,
    rotatePage,
    completeExternalImport,
  } = usePdfDocument(studentNumber, moduleId, loadDocuments)
  
const [highlightMode, setHighlightMode] = useState(false)
  const { selection: wordSelection, closeSelection } = useTextSelectionLookup(pdfContainerRef, highlightMode);

  const { pendingHighlight, clearPendingHighlight } = useHighlightSelection(pdfContainerRef, highlightMode)
  const { pendingNote, clearPendingNote } = useNoteSuggestion(pdfContainerRef, !highlightMode)
  const { highlights, saveHighlight, openNoteHighlightId, toggleNote } = useHighlights(pdfUrl)
const { activeStep, isLastStep, next: nextTourStep, skip: skipTour, isActive: isTourActive, forceNavOpen, forcePdfControlsOpen, forceImportOpen, dismissBlockingStep } =
    useTour({ studentNumber, pdfUrl, aiSidebarOpen, uploading })


  const fitToScreenAndToggleFullscreen = () => {
    fitToScreen()
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
      })
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('drive_connected') === 'true') {
    setShowDriveBrowser(true)
  }
}, [])

  return (
    <div style={containerStyle}>
      {/* TOP navigation zone */}
      <div style={topHoverZoneStyle} onMouseEnter={openNav} onMouseLeave={closeNavDelayed} />

      {/* LEFT HOVER ZONE(pdf editing) */}
      <div style={leftHoverZoneStyle} onMouseEnter={openPdfControls} onMouseLeave={closePdfControlsDelayed} />

     <div
        ref={pdfContainerRef}
        style={getPdfContainerStyle(aiSidebarOpen ? aiSidebarWidth : 0)}
        onScroll={handleContainerScroll}
      >
        <PdfViewer
          pdfUrl={pdfUrl}
          numPages={numPages}
          scale={scale}
          rotation={rotation}
          uploading={uploading}
          onDocumentLoadSuccess={onDocumentLoadSuccess}
          generateThumbnails={generateThumbnails}
          updatePage={updatePage}
          handleFileUpload={handleFileUpload}
          highlights={highlights}
          openNoteHighlightId={openNoteHighlightId}
          onToggleNote={toggleNote}
          highlightMode={highlightMode}
          onUploadIntent={dismissBlockingStep}
        />
      </div>

      {/* PDF CONTROLS - Left Sidebar */}
      {pdfUrl && (
<PdfControlsSidebar
          pdfFileName={pdfFile?.name}
          scale={scale}
          showPdfControls={showPdfControls || forcePdfControlsOpen}
          openPdfControls={openPdfControls}
          closePdfControlsDelayed={closePdfControlsDelayed}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          fitToScreen={fitToScreenAndToggleFullscreen}
          onShowThumbnails={() => setShowThumbnails(true)}
          rotatePage={rotatePage}
          highlightMode={highlightMode}
          onToggleHighlightMode={() => setHighlightMode((prev) => !prev)}
        />
      )}

{showThumbnails && (
        <ThumbnailSidebar
          sidebarRef={sidebarRef}
          pageThumbnails={pageThumbnails}
          currentPage={currentPage}
          onPageSelect={(page) => {
            goToPage(page)
            setShowThumbnails(false)
          }}
        />
      )}

      {/* TOP SECTION - Fixed overlay */}
      <div style={topSectionStyle}>
        <StudyTimer />

       <TopNavBar
          showNav={showNav || forceNavOpen}
          forceImportOpen={forceImportOpen}
          onUploadIntent={dismissBlockingStep}
          openNav={openNav}
          closeNavDelayed={closeNavDelayed}
          documents={documents}
          onOpenDocument={openDocumentFromHistory}
          onImportNew={() => setShowUploadPopup(true)}
          onDeleteDocument={async (doc) => {
            if (!studentNumber) return

            try {
              const res = await fetch('/api/pdfs/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdf_id: doc.pdf_id, student_number: studentNumber }),
              })

              const data = await res.json()

              if (!res.ok) {
                console.error('Delete failed:', data.error)
                return
              }

              await loadDocuments()
            } catch (err) {
              console.error('Delete failed:', err)
            }
          }}
        />
      </div>

      {showUploadPopup && (
        <UploadPopup
          onClose={() => setShowUploadPopup(false)}
          onFileSelected={handleFileUpload}
          studentNumber={studentNumber}
        />
      )}

{showDriveBrowser && studentNumber && (
  <DriveFileBrowser
    studentNumber={studentNumber}
    onClose={() => setShowDriveBrowser(false)}
onFileSelected={async (file) => {
      setShowDriveBrowser(false)
      setDriveImportingFile(file.name)

      try {
        const res = await fetch('/api/drive/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_number: studentNumber,
            module_id: moduleId,
            file_id: file.id,
            file_name: file.name,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          console.error('Drive import failed:', data.error)
          return
        }

        completeExternalImport(data.file_url, file.name, data.pdf_id)
        await loadDocuments()
      } catch (err) {
        console.error('Drive import failed:', err)
      } finally {
        setDriveImportingFile(null)
      }
    }}
    
  />
)}

{driveImportingFile && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}
  >
    <div
      style={{
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: '32px 40px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(255,255,255,0.2)',
          borderTopColor: '#4CAF50',
          borderRadius: '50%',
          animation: 'drive-spin 0.8s linear infinite',
        }}
      />
      <div style={{ color: 'white', fontSize: '14px', textAlign: 'center' }}>
        ☁️ Importing <strong>{driveImportingFile}</strong> from Drive...
      </div>
    </div>
    <style>{`
      @keyframes drive-spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)}

{wordSelection && (
  <DictionaryPopup selection={wordSelection} onClose={closeSelection} />
)}

{pendingHighlight && (
  <HighlightNotePopup
    pending={pendingHighlight}
    onSave={async (note) => {
      await saveHighlight(pendingHighlight, note)
      clearPendingHighlight()
    }}
    onCancel={clearPendingHighlight}
  />
)}

{pendingNote && (
  <SaveToNotePopup
    pending={pendingNote}
    onSave={async () => {
      await saveHighlight(pendingNote, '')
      clearPendingNote()
    }}
    onDismiss={clearPendingNote}
  />
)}

{isTourActive && activeStep && (
  <TourTooltip
    key={activeStep.id}
    step={activeStep}
    onNext={nextTourStep}
    onSkip={skipTour}
    isLastStep={isLastStep}
  />
)}

      <AiSidebar
        pdfUrl={pdfUrl}
        isOpen={aiSidebarOpen}
        pdfId={pdfId}
        onOpenChange={setAiSidebarOpen}
        width={aiSidebarWidth}
        onWidthChange={setAiSidebarWidth}
        currentPage={currentPage}
        totalPages={numPages ?? 0}
      />
    </div>
  )
}
