import { useEffect, useState, useCallback } from 'react'

export interface VideoRecommendation {
  video_id: string
  title: string
  channel_title: string
  thumbnail_url: string | null
  description: string
  duration_seconds: number | null
  topic: string
}

export interface VideoBatch {
  batch_id: number
  pdf_id: number
  bucket_start_page: number
  bucket_end_page: number
  model: string
  created_at: string
  pdf_video_recommendations: VideoRecommendation[]
}

export function useVideos(pdfId: number | null, currentPage: number, totalPages: number) {
  const [bucket, setBucket] = useState<{ bucket_start_page: number; bucket_end_page: number } | null>(null)
  const [batches, setBatches] = useState<VideoBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBatches = useCallback(async () => {
    if (!pdfId || !currentPage || !totalPages) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/videos/list?pdf_id=${pdfId}&page=${currentPage}&total_pages=${totalPages}`
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to load videos')
        return
      }

      setBucket({ bucket_start_page: data.bucket_start_page, bucket_end_page: data.bucket_end_page })
      setBatches(data.batches ?? [])
    } catch {
      setError('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [pdfId, currentPage, totalPages])

  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  const generateBatch = async () => {
    if (!pdfId || !bucket) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_id: pdfId,
          bucket_start_page: bucket.bucket_start_page,
          bucket_end_page: bucket.bucket_end_page,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to find videos')
        return
      }

      const newBatch: VideoBatch = {
        batch_id: data.batch_id,
        pdf_id: data.pdf_id,
        bucket_start_page: data.bucket_start_page,
        bucket_end_page: data.bucket_end_page,
        model: data.model,
        created_at: data.created_at,
        pdf_video_recommendations: data.videos,
      }

      setBatches((prev) => [newBatch, ...prev])
      return newBatch
    } catch {
      setError('Failed to find videos')
    } finally {
      setGenerating(false)
    }
  }

  return { bucket, batches, loading, generating, error, generateBatch, reload: loadBatches }
}
