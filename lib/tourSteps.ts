export type TourStage = 'upload' | 'pdf' | 'ai' | 'done'

export interface TourStepDef {
  id: string
  target: string // matches a data-tour="..." attribute in the DOM
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  requiresPanel?: 'nav' | 'pdfControls' // which hidden panel to force open for this step
  hint?: string
  forceImportDropdown?: boolean 
  secondaryTarget?: string // a second element to ring/highlight alongside the main target
  blocking?: boolean
}

export const TOUR_STEPS: Record<Exclude<TourStage, 'done'>, TourStepDef[]> = {
  upload: [
    {
      id: 'import',
      target: 'top-nav-import',
      title: 'Import a document',
      content: 'Start by uploading a PDF from your device, or import one from Google Drive.',
      placement: 'bottom',
      requiresPanel: 'nav',
      hint: 'Tip: move your mouse to the very top of the screen anytime to bring this bar back.',
    },
    {
      id: 'music',
      target: 'top-nav-music',
      title: 'Focus music',
      content: 'Play background music or focus sounds while you study, right from this menu.',
      placement: 'bottom',
      requiresPanel: 'nav',
    },
    {
      id: 'notes',
      target: 'top-nav-notes',
      title: 'Quick notes',
      content: 'Jot down notes as you study, separate from highlights made directly on the document.',
      placement: 'bottom',
      requiresPanel: 'nav',
    },
    {
      id: 'change-module',
      target: 'top-nav-change-module',
      title: 'Switch modules',
      content: 'Jump to a different module at any time without losing your place in this one.',
      placement: 'bottom',
      requiresPanel: 'nav',
    },
  {
      id: 'profile',
      target: 'top-nav-profile',
      title: 'Your profile',
      content: 'Manage your account settings and preferences from here.',
      placement: 'left',
      requiresPanel: 'nav',
    },
{
      id: 'upload-required',
      target: 'pdf-upload-button',
      secondaryTarget: 'top-nav-import-new',
      title: 'Add a document to get started',
      content: 'Upload a PDF here in the middle of the page, or use Import in the top bar — either one works.',
      placement: 'bottom',
      requiresPanel: 'nav',
      forceImportDropdown: true,
      blocking: true,
    },
  ],
  pdf: [
{
      id: 'fit',
      target: 'pdf-controls-fit',
      title: 'Fit to screen',
      content: 'Automatically resize the page to fit your screen and toggle fullscreen mode.',
      placement: 'right',
      requiresPanel: 'pdfControls',
      hint: 'Tip: move your mouse to the left edge of the screen anytime to bring these controls back.',
    },
    {
      id: 'thumbnails',
      target: 'pdf-controls-thumbnails',
      title: 'Page thumbnails',
      content: 'Jump straight to any page from the thumbnail view.',
      placement: 'right',
      requiresPanel: 'pdfControls',
    },
    {
      id: 'rotate',
      target: 'pdf-controls-rotate',
      title: 'Rotate a page',
      content: 'Rotate the current page if it was scanned sideways or upside down.',
      placement: 'right',
      requiresPanel: 'pdfControls',
    },
    {
      id: 'highlight',
      target: 'pdf-controls-highlight',
      title: 'Highlight & take notes',
      content: 'Turn on highlight mode to mark up text and attach notes.',
      placement: 'right',
      requiresPanel: 'pdfControls',
    },
 {
      id: 'download',
      target: 'pdf-controls-download',
      title: 'Download this PDF',
      content: 'Save a copy of this document straight to your device.',
      placement: 'right',
      requiresPanel: 'pdfControls',
    },
    {
      id: 'history',
      target: 'top-nav-history',
      title: 'Your documents',
      content: 'Every document you upload is saved here so you can jump back in anytime.',
      placement: 'bottom',
      requiresPanel: 'nav',
      forceImportDropdown: true,
    },
  ],
  ai: [],
}