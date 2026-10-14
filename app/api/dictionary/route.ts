import { NextResponse } from 'next/server'
import { lookupWord } from '@/lib/dictionary'

export async function GET(request: Request) {
  const word = new URL(request.url).searchParams.get('word') ?? ''

  if (!word.trim()) {
    return NextResponse.json({ error: 'word is required' }, { status: 400 })
  }

  const result = await lookupWord(word)

  if (result.status === 'found') {
    return NextResponse.json(
      { found: true, entry: result.entry, lookedUp: result.lookedUp },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    )
  }

  if (result.status === 'missing') {
    return NextResponse.json({ found: false }, { headers: { 'Cache-Control': 'private, max-age=600' } })
  }

  return NextResponse.json({ error: 'Dictionary services are unreachable right now' }, { status: 502 })
}
