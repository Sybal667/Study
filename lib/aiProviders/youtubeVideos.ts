const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'
const EDUCATION_CATEGORY_ID = '27'

export interface VideoResult {
  id: string
  title: string
  channelTitle: string
  thumbnail: string | null
  description: string
  durationSeconds: number | null
  topic: string
}

function parseIso8601Duration(duration: string): number | null {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration)
  if (!match) return null

  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  const seconds = parseInt(match[3] ?? '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

async function searchOneTopic(topic: string, apiKey: string, maxResults: number) {
  const url = new URL(YOUTUBE_SEARCH_URL)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', topic)
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoCategoryId', EDUCATION_CATEGORY_ID)
  url.searchParams.set('safeSearch', 'strict')
  url.searchParams.set('relevanceLanguage', 'en')
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())

  if (!res.ok) {
    const errText = await res.text()
    console.error(`❌ YouTube search failed for topic "${topic}":`, errText)
    return []
  }

  const data = await res.json()

  return (data.items ?? [])
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      id: item.id.videoId as string,
      title: item.snippet.title as string,
      channelTitle: item.snippet.channelTitle as string,
      thumbnail: (item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url) as string | null,
      description: (item.snippet.description as string) ?? '',
      topic,
    }))
}

async function fetchDurations(videoIds: string[], apiKey: string): Promise<Map<string, number | null>> {
  const durations = new Map<string, number | null>()
  if (!videoIds.length) return durations

  const chunkSize = 50
  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const chunk = videoIds.slice(i, i + chunkSize)

    const url = new URL(YOUTUBE_VIDEOS_URL)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('id', chunk.join(','))
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const errText = await res.text()
      console.error('❌ YouTube videos.list failed:', errText)
      continue
    }

    const data = await res.json()
    for (const item of data.items ?? []) {
      durations.set(item.id, parseIso8601Duration(item.contentDetails?.duration ?? ''))
    }
  }

  return durations
}

export async function searchEducationalVideos(topics: string[], maxResultsPerTopic = 4): Promise<VideoResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not set')
  }

  const resultsPerTopic = await Promise.all(
    topics.map((topic) => searchOneTopic(topic, apiKey, maxResultsPerTopic))
  )

  const seen = new Set<string>()
  const combined = resultsPerTopic.flat().filter((video) => {
    if (seen.has(video.id)) return false
    seen.add(video.id)
    return true
  })

  const durations = await fetchDurations(
    combined.map((v) => v.id),
    apiKey
  )

  return combined.map((video) => ({
    ...video,
    durationSeconds: durations.get(video.id) ?? null,
  }))
}
