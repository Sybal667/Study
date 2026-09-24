import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrRefreshPracticeFileUri, PRACTICE_MODEL } from '@/lib/aiProviders/practiceGemini'
import { generateVideoTopics } from '@/lib/aiProviders/videoTopics'
import { searchEducationalVideos } from '@/lib/aiProviders/youtubeVideos'

export async function POST(request: Request) {
  try {
    const { pdf_id, bucket_start_page, bucket_end_page } = (await request.json()) as {
      pdf_id: number
      bucket_start_page: number
      bucket_end_page: number
    }

    if (!pdf_id || !bucket_start_page || !bucket_end_page) {
      return NextResponse.json(
        { error: 'pdf_id, bucket_start_page and bucket_end_page are required' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      console.error('❌ Supabase Admin client is not initialized')
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
    }

    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('file_url')
      .eq('pdf_id', pdf_id)
      .maybeSingle()

    if (pdfErr || !pdfRow) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    let topics: string[]
    let videos

    try {
      const geminiFileUri = await getOrRefreshPracticeFileUri(pdf_id, pdfRow.file_url)

      topics = await generateVideoTopics({
        geminiFileUri,
        bucketStartPage: bucket_start_page,
        bucketEndPage: bucket_end_page,
      })

      videos = await searchEducationalVideos(topics)
    } catch (err) {
      console.error('❌ Video recommendation generation failed:', err)

      if (err instanceof Error && err.message === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: 'Daily AI limit reached — try again tomorrow.' },
          { status: 429 }
        )
      }

      if (err instanceof Error && err.message === 'MODEL_OVERLOADED') {
        return NextResponse.json(
          { error: 'Gemini is under heavy load right now — try again in a minute or two.' },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Failed to find videos, please try again' }, { status: 502 })
    }

    if (!videos.length) {
      return NextResponse.json({ error: 'No matching videos were found' }, { status: 404 })
    }

    const { data: batchRow, error: batchErr } = await supabaseAdmin
      .from('pdf_video_batches')
      .insert({
        pdf_id,
        bucket_start_page,
        bucket_end_page,
        model: PRACTICE_MODEL,
      })
      .select('batch_id, pdf_id, bucket_start_page, bucket_end_page, created_at')
      .single()

    if (batchErr || !batchRow) {
      console.error('❌ Failed to save video batch:', batchErr)
      return NextResponse.json({ error: 'Failed to save video results' }, { status: 500 })
    }

    const { data: videoRows, error: videosErr } = await supabaseAdmin
      .from('pdf_video_recommendations')
      .insert(
        videos.map((v) => ({
          batch_id: batchRow.batch_id,
          video_id: v.id,
          title: v.title,
          channel_title: v.channelTitle,
          thumbnail_url: v.thumbnail,
          description: v.description,
          duration_seconds: v.durationSeconds,
          topic: v.topic,
        }))
      )
      .select('video_id, title, channel_title, thumbnail_url, description, duration_seconds, topic')

    if (videosErr || !videoRows) {
      console.error('❌ Failed to save video recommendations:', videosErr)
      return NextResponse.json({ error: 'Failed to save video results' }, { status: 500 })
    }

    return NextResponse.json({
      ...batchRow,
      topics,
      videos: videoRows,
    })
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
