'use client'

import { navButtonStyle } from '@/lib/studyStyles'

export default function AiVideosTab() {
  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3, 4].map((video) => (
        <div
          key={video}
          style={{
            ...navButtonStyle,
            padding: '16px',
            textAlign: 'left',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.1)',
            cursor: 'pointer',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(30, 58, 138, 0.4)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0,
              }}
            >
              🎬
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '15px' }}>
                Understanding Concept {video}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.6, display: 'flex', gap: '12px' }}>
                <span>📊 {85 - video * 5}% match</span>
                <span>⏱️ {12 + video}:{String(34 + video * 10).padStart(2, '0')}</span>
                <span>👤 Teacher {video}</span>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                A comprehensive explanation of this topic with examples
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}