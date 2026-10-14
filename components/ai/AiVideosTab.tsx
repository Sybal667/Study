'use client'

import { useState } from 'react'
import { navButtonStyle } from '@/lib/studyStyles'
import { useVideos, type VideoRecommendation } from '@/hooks/useVideos'

interface AiVideosTabProps {
  pdfId: number | null
  currentPage: number
  totalPages: number
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function matchColor(percent: number): string {
  if (percent >= 60) return '#4ade80'
  if (percent >= 35) return '#facc15'
  return '#f87171'
}

export default function AiVideosTab({ pdfId, currentPage, totalPages }: AiVideosTabProps) {
  const { bucket, batches, loading, generating, error, generateBatch } = useVideos(pdfId, currentPage, totalPages)
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const [playerStart, setPlayerStart] = useState<number>(0)

  if (!pdfId) {
    return (
      <div style={{ fontSize: '13px', opacity: 0.6, color: 'white' }}>
        Open a PDF to find videos for it.
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ fontSize: '13px', opacity: 0.6, color: 'white' }}>
        Loading videos...
      </div>
    )
  }

  const allVideos: VideoRecommendation[] = batches
    .flatMap((batch) => batch.pdf_video_recommendations)
    .sort((a, b) => (b.match_percent ?? -1) - (a.match_percent ?? -1))

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {bucket && (
        <div style={{ fontSize: '13px', opacity: 0.7, color: 'white' }}>
          Pages {bucket.bucket_start_page}–{bucket.bucket_end_page}
        </div>
      )}

      {error && <div style={{ fontSize: '13px', color: '#ff8080' }}>{error}</div>}

      {allVideos.length === 0 && !generating && (
        <div style={{ fontSize: '13px', opacity: 0.6, color: 'white' }}>
          No videos found yet for this section.
        </div>
      )}

      {allVideos.map((video) => {
        const isExpanded = expandedVideoId === video.video_id

        return (
          <div
            key={video.video_id}
            style={{
              ...navButtonStyle,
              padding: '16px',
              textAlign: 'left',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
              color: 'white',
            }}
            onClick={() => {
              setPlayerStart(0)
              setExpandedVideoId(isExpanded ? null : video.video_id)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
            }}
          >
            {isExpanded ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, marginBottom: '10px', borderRadius: '6px', overflow: 'hidden' }}>
                <iframe
                  key={`${video.video_id}-${playerStart}`}
                  src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&start=${playerStart}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {!isExpanded && (
                video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
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
                )
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '15px' }}>
                  {video.title}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.6, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>👤 {video.channel_title}</span>
                  {video.duration_seconds !== null && <span>⏱️ {formatDuration(video.duration_seconds)}</span>}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                  📌 {video.topic}
                </div>
                <div
                  title={
                    video.match_percent !== null
                      ? `Overall match: keywords found ${video.keyword_percent ?? '—'}%${
                          video.semantic_percent !== null ? `, meaning similarity ${video.semantic_percent}%` : ''
                        }. Based on pages ${bucket?.bucket_start_page}–${bucket?.bucket_end_page} compared with the video's captions.`
                      : 'No captions were available for this video, so a match could not be calculated.'
                  }
                  style={{ marginTop: '8px' }}
                >
                  {video.match_percent !== null ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ opacity: 0.7 }}>🎯 Matches your text</span>
                        <span style={{ fontWeight: 'bold', color: matchColor(video.match_percent) }}>
                          {video.match_percent}%
                        </span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${video.match_percent}%`,
                            height: '100%',
                            borderRadius: '999px',
                            backgroundColor: matchColor(video.match_percent),
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', opacity: 0.55, marginTop: '5px', flexWrap: 'wrap' }}>
                        {video.keyword_percent !== null && <span>Keywords {video.keyword_percent}%</span>}
                        {video.semantic_percent !== null && <span>Meaning {video.semantic_percent}%</span>}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', opacity: 0.5 }}>🎯 Match unavailable (no captions)</div>
                  )}
                </div>
                {video.best_start_seconds !== null && video.best_end_seconds !== null && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPlayerStart(video.best_start_seconds ?? 0)
                      setExpandedVideoId(video.video_id)
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      color: 'white',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(30, 58, 138, 0.6)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                    }}
                  >
                    ▶ Best part: {formatDuration(video.best_start_seconds)} – {formatDuration(video.best_end_seconds)}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button
        onClick={generateBatch}
        disabled={generating}
        style={{
          ...navButtonStyle,
          backgroundColor: 'rgba(30, 58, 138, 0.6)',
          borderColor: 'rgba(255,255,255,0.2)',
          fontWeight: 'bold',
          color: 'white',
          opacity: generating ? 0.5 : 1,
          cursor: generating ? 'not-allowed' : 'pointer',
        }}
      >
        {generating ? 'Finding videos...' : allVideos.length > 0 ? 'Find more videos' : 'Find videos for this section'}
      </button>
    </div>
  )
}
