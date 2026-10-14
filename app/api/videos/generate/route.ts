import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrRefreshPracticeFileUri, PRACTICE_MODEL } from '@/lib/aiProviders/practiceGemini'
import { generateVideoTopics } from '@/lib/aiProviders/videoTopics'
import { searchEducationalVideos } from '@/lib/aiProviders/youtubeVideos'
import { extractPdfPages, scoreVideos, type MatchResult } from '@/lib/aiProviders/videoMatch'

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      console.error('❌ Supabase Admin client is not initialized')
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 })
    }

    const { data: student, error: studentErr } = await supabaseAdmin
      .from('students')
      .select('student_number')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (studentErr || !student) {
      console.error('❌ Failed to resolve authenticated student:', studentErr)
      return NextResponse.json({ error: 'Student account not found' }, { status: 403 })
    }

    const body = await request.json()
    const { pdf_id, bucket_start_page, bucket_end_page } = body

    if (
      !Number.isSafeInteger(pdf_id) ||
      pdf_id <= 0 ||
      !Number.isSafeInteger(bucket_start_page) ||
      !Number.isSafeInteger(bucket_end_page) ||
      bucket_start_page < 1 ||
      bucket_end_page < bucket_start_page ||
      bucket_end_page - bucket_start_page + 1 > 50
    ) {
      return NextResponse.json(
        { error: 'Valid pdf_id and page range of at most 50 pages are required' },
        { status: 400 }
      )
    }

    const { data: pdfRow, error: pdfErr } = await supabaseAdmin
      .from('student_pdfs')
      .select('pdf_id, file_url')
      .eq('pdf_id', pdf_id)
      .eq('student_number', student.student_number)
      .maybeSingle()

    if (pdfErr) {
      console.error('❌ Failed to verify PDF ownership:', pdfErr)
      return NextResponse.json({ error: 'Failed to verify PDF ownership' }, { status: 500 })
    }

    if (!pdfRow) {
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

    let matchScores = new Map<string, MatchResult>()

    try {
      const pages = await extractPdfPages(pdfRow.file_url, bucket_end_page)
      matchScores = await scoreVideos(
        videos.map((v) => ({ id: v.id, durationSeconds: v.durationSeconds })),
        pages,
        bucket_start_page,
        bucket_end_page
      )

      matchScores.forEach((score, id) => {
        console.log('[video-match]', id, JSON.stringify(score))
      })
    } catch (err) {
      console.error('⚠️ Video match scoring failed:', err)
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
          match_percent: matchScores.get(v.id)?.matchPercent ?? null,
          keyword_percent: matchScores.get(v.id)?.keywordPercent ?? null,
          semantic_percent: matchScores.get(v.id)?.semanticPercent ?? null,
          best_start_seconds: matchScores.get(v.id)?.bestStartSeconds ?? null,
          best_end_seconds: matchScores.get(v.id)?.bestEndSeconds ?? null,
          topic: v.topic,
        }))
      )
      .select('video_id, title, channel_title, thumbnail_url, description, duration_seconds, match_percent, keyword_percent, semantic_percent, best_start_seconds, best_end_seconds, topic')

    if (videosErr || !videoRows) {
      console.error('❌ Failed to save video recommendations:', videosErr)
      return NextResponse.json({ error: 'Failed to save video results' }, { status: 500 })
    }

    return NextResponse.json(
      {
        ...batchRow,
        topics,
        videos: videoRows,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('❌ API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}