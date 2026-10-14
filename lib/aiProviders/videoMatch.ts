import {
  chunkSegments,
  cosineSimilarity,
  extractKeyTerms,
  blendScores,
  MIN_KEY_TERMS,
  normalizeSegments,
  pickTopChunkIndexes,
  scoreLexical,
  semanticPercentFromCosines,
  type Chunk,
  type LexicalResult,
  type Segment,
} from './videoMatchCore'

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
const EMBEDDING_BATCH_LIMIT = 100
const EMBEDDING_TIMEOUT_MS = 20_000
const EMBED_CHUNKS_PER_VIDEO = 5
const MAX_SECTION_WORDS = 1200
const MAX_CHUNK_WORDS = 250
const TRANSCRIPT_TIMEOUT_MS = 10_000
const TRANSCRIPT_CONCURRENCY = 4
const MIN_PAGES_TO_PARSE = 100
const MIN_BEST_SEGMENT_PERCENT = 10

export interface VideoToScore {
  id: string
  durationSeconds: number | null
}

export interface MatchResult {
  matchPercent: number | null
  keywordPercent: number | null
  semanticPercent: number | null
  bestStartSeconds: number | null
  bestEndSeconds: number | null
}

export interface ScoreDeps {
  fetchSegments: (videoId: string, durationSeconds: number | null) => Promise<Segment[] | null>
  embed: (texts: string[]) => Promise<number[][] | null>
}

const EMPTY_RESULT: MatchResult = {
  matchPercent: null,
  keywordPercent: null,
  semanticPercent: null,
  bestStartSeconds: null,
  bestEndSeconds: null,
}

export async function extractPdfPages(fileUrl: string, endPage: number): Promise<string[]> {
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')

  const res = await fetch(fileUrl)
  if (!res.ok) {
    throw new Error(`Failed to download PDF (${res.status})`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const pages: string[] = []

  await pdfParse(buffer, {
    max: Math.max(endPage, MIN_PAGES_TO_PARSE),
    pagerender: async (pageData: any) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      })

      let lastY: number | undefined
      let text = ''

      for (const item of textContent.items) {
        if (lastY === undefined || lastY === item.transform[5]) {
          text += item.str
        } else {
          text += '\n' + item.str
        }
        lastY = item.transform[5]
      }

      const index = typeof pageData.pageNumber === 'number' ? pageData.pageNumber - 1 : pages.length
      pages[index] = text

      return text
    },
  })

  return Array.from(pages, (page) => page ?? '')
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export async function fetchVideoSegments(videoId: string, durationSeconds: number | null): Promise<Segment[] | null> {
  try {
    const { fetchTranscript } = await import('youtube-transcript')

    let raw
    try {
      raw = await withTimeout(fetchTranscript(videoId, { lang: 'en' }), TRANSCRIPT_TIMEOUT_MS, 'Transcript request')
    } catch {
      raw = await withTimeout(fetchTranscript(videoId), TRANSCRIPT_TIMEOUT_MS, 'Transcript request')
    }

    const segments = normalizeSegments(raw, durationSeconds)
    return segments.length ? segments : null
  } catch (err) {
    console.error(`⚠️ No transcript for video ${videoId}:`, err instanceof Error ? err.message : err)
    return null
  }
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('⚠️ Skipping semantic match: GEMINI_API_KEY is not set')
    return null
  }

  if (!texts.length || texts.length > EMBEDDING_BATCH_LIMIT) {
    console.error(`⚠️ Skipping semantic match: invalid batch size ${texts.length}`)
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS)

  try {
    const res = await fetch(`${GEMINI_MODELS_URL}/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType: 'SEMANTIC_SIMILARITY',
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`⚠️ Embedding request failed (${res.status}): ${errText.slice(0, 300)}`)
      return null
    }

    const data = await res.json()
    const embeddings: unknown = data?.embeddings

    if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
      console.error('⚠️ Embedding response had an unexpected shape')
      return null
    }

    const vectors = embeddings.map((entry: any) => entry?.values)
    if (!vectors.every((vector: unknown) => Array.isArray(vector) && vector.length > 0)) {
      console.error('⚠️ Embedding response contained empty vectors')
      return null
    }

    return vectors as number[][]
  } catch (err) {
    console.error('⚠️ Embedding request error:', err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const defaultDeps: ScoreDeps = {
  fetchSegments: fetchVideoSegments,
  embed: embedTexts,
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  return words.length <= maxWords ? text.trim() : words.slice(0, maxWords).join(' ')
}

interface VideoAnalysis {
  id: string
  chunks: Chunk[]
  lexical: LexicalResult
  shortlist: number[]
}

export async function scoreVideos(
  videos: VideoToScore[],
  pages: string[],
  startPage: number,
  endPage: number,
  deps: ScoreDeps = defaultDeps
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>()
  videos.forEach((video) => results.set(video.id, { ...EMPTY_RESULT }))

  const sectionText = pages.slice(startPage - 1, endPage).join('\n')
  const keyTerms = extractKeyTerms(sectionText, pages)

  if (keyTerms.length < MIN_KEY_TERMS) {
    console.error(`⚠️ Not enough readable text on pages ${startPage}-${endPage} to score videos`)
    return results
  }

  const analyses: VideoAnalysis[] = []
  let cursor = 0

  async function worker() {
    while (cursor < videos.length) {
      const video = videos[cursor++]
      const segments = await deps.fetchSegments(video.id, video.durationSeconds)
      if (!segments) continue

      const chunks = chunkSegments(segments)
      const lexical = scoreLexical(keyTerms, chunks)
      if (!lexical) continue

      analyses.push({
        id: video.id,
        chunks,
        lexical,
        shortlist: pickTopChunkIndexes(lexical.chunkPercents, EMBED_CHUNKS_PER_VIDEO),
      })
    }
  }

  await Promise.all(Array.from({ length: Math.min(TRANSCRIPT_CONCURRENCY, videos.length) }, worker))

  analyses.sort((a, b) => videos.findIndex((v) => v.id === a.id) - videos.findIndex((v) => v.id === b.id))

  const semanticByVideo = new Map<string, number | null>()

  if (analyses.length > 0) {
    let perVideo = EMBED_CHUNKS_PER_VIDEO
    while (perVideo > 1 && 1 + analyses.length * perVideo > EMBEDDING_BATCH_LIMIT) perVideo--

    const texts: string[] = [truncateWords(sectionText, MAX_SECTION_WORDS)]
    const owners: { id: string; start: number; count: number }[] = []

    for (const analysis of analyses) {
      const picked = analysis.shortlist.slice(0, perVideo)
      owners.push({ id: analysis.id, start: texts.length, count: picked.length })
      picked.forEach((index) => texts.push(truncateWords(analysis.chunks[index].text, MAX_CHUNK_WORDS)))
    }

    const vectors = texts.length <= EMBEDDING_BATCH_LIMIT ? await deps.embed(texts) : null

    if (vectors && vectors.length === texts.length) {
      const sectionVector = vectors[0]

      for (const owner of owners) {
        const cosines = vectors
          .slice(owner.start, owner.start + owner.count)
          .map((vector) => cosineSimilarity(sectionVector, vector))
        semanticByVideo.set(owner.id, semanticPercentFromCosines(cosines))
      }
    }
  }

  for (const analysis of analyses) {
    const semanticPercent = semanticByVideo.get(analysis.id) ?? null

    const hasBestSegment = analysis.lexical.bestPercent >= MIN_BEST_SEGMENT_PERCENT

    results.set(analysis.id, {
      matchPercent: blendScores(analysis.lexical.keywordPercent, semanticPercent),
      keywordPercent: analysis.lexical.keywordPercent,
      semanticPercent,
      bestStartSeconds: hasBestSegment ? analysis.lexical.bestStartSeconds : null,
      bestEndSeconds: hasBestSegment ? analysis.lexical.bestEndSeconds : null,
    })
  }

  return results
}
