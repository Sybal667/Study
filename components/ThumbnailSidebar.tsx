'use client'

import { RefObject } from 'react'
import { THUMB_ITEM_HEIGHT } from '@/hooks/usePdfDocument'

interface ThumbnailSidebarProps {
  sidebarRef: RefObject<HTMLDivElement | null>
  // One entry per page. An empty string means the thumbnail has not been created yet.
  pageThumbnails: string[]
  currentPage: number
  onPageSelect: (page: number) => void
}

export default function ThumbnailSidebar({ sidebarRef, pageThumbnails, currentPage, onPageSelect }: ThumbnailSidebarProps) {
  return (
    <div
      ref={sidebarRef}
      style={{
        position: 'fixed',
        left: '80px',
        top: 0,
        bottom: 0,
        width: '220px',
        backgroundColor: 'rgba(0,0,0,0.9)',
        overflowY: 'auto',
        padding: '12px',
        zIndex: 60,
      }}
    >
      <div style={{ color: 'white', marginBottom: '12px' }}>Pages</div>

      {pageThumbnails.map((thumb, index) => (
        <div
          key={index}
          onClick={() => onPageSelect(index + 1)}
          style={{
            // Every slot has the same fixed height so scrolling to a page and
            // working out which thumbnails are visible is exact.
            height: THUMB_ITEM_HEIGHT - 10,
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            border: currentPage === index + 1 ? '2px solid #4CAF50' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            overflow: 'hidden',
            opacity: currentPage === index + 1 ? 1 : 0.7,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}
          >
            {thumb ? (
              <img
                src={thumb}
                alt={`Page ${index + 1}`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <span style={{ color: 'white', opacity: 0.4, fontSize: '12px' }}>Loading...</span>
            )}
          </div>
          <div
            style={{
              color: 'white',
              fontSize: '12px',
              textAlign: 'center',
              padding: '4px',
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
          >
            Page {index + 1}
          </div>
        </div>
      ))}
    </div>
  )
}
