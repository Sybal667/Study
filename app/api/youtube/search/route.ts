import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 })
  }

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('q', query)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('videoCategoryId', '10') // Music category
  searchUrl.searchParams.set('maxResults', '10')
  searchUrl.searchParams.set('key', apiKey)

  const res = await fetch(searchUrl.toString())

  if (!res.ok) {
    const errText = await res.text()
    console.error('YouTube API error:', errText)
    return NextResponse.json({ error: 'YouTube search failed' }, { status: res.status })
  }

  const data = await res.json()

  const results = data.items.map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.default?.url,
  }))

  return NextResponse.json({ results })
}