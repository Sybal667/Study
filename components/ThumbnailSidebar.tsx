'use client'

import { RefObject } from 'react'

interface ThumbnailSidebarProps {
  sidebarRef: RefObject<HTMLDivElement | null>
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
            marginBottom: '10px',
            cursor: 'pointer',
            border: currentPage === index + 1 ? '2px solid #4CAF50' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            overflow: 'hidden',
            opacity: currentPage === index + 1 ? 1 : 0.7,
          }}
        >
          <img src={thumb} style={{ width: '100%', display: 'block' }} />
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
