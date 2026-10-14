export const MAX_KEY_TERMS = 60
export const MIN_KEY_TERMS = 5
export const MIN_TRANSCRIPT_WORDS = 30
export const CHUNK_TARGET_WORDS = 180
export const COSINE_FLOOR = 0.45
export const COSINE_CEILING = 0.85
export const KEYWORD_BLEND_WEIGHT = 0.5

export const STOPWORDS = new Set(
  (
    'a about above after again against all also am an and any are aren as at be because been before being below ' +
    'between both but by can cannot could did do does doing down during each either else few for from further had ' +
    'has have having he her here hers herself him himself his how however i if in into is it its itself just let ' +
    'like may me might more most much must my myself no nor not now of off on once one only or other our ours ' +
    'ourselves out over own per same shall she should so some such than that the their theirs them themselves then ' +
    'there these they this those through thus to too under until up upon us use used using very was we well were ' +
    'what when where whether which while who whom whose why will with within without would yet you your yours ' +
    'yourself yourselves figure fig table page pages chapter section example examples etc eg ie according ' +
    'gonna wanna yeah okay ok um uh actually basically really going know think see say said look want need ' +
    'make makes made take takes get gets got go goes come comes thing things way ways lot lots bit kind sort ' +
    'right left first second third next last new back even still also often many several every another ' +
    'video videos subscribe channel today welcome hello hi thanks thank'
  ).split(/\s+/)
)

export function stem(word: string): string {
  let w = word

  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && w.endsWith('ied')) return w.slice(0, -3) + 'y'
  if (w.length > 5 && w.endsWith('sses')) return w.slice(0, -2)

  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 4 && /(s|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)

  if (w.length > 4 && w.endsWith('ly')) w = w.slice(0, -2)
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1)

  return w
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    .map(stem)
    .filter((word) => word.length >= 3)
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export interface KeyTerm {
  term: string
  weight: number
}

export function extractKeyTerms(sectionText: string, allPagesText: string[] = []): KeyTerm[] {
  const counts = new Map<string, number>()

  for (const token of tokenize(sectionText)) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  const pageCount = allPagesText.length
  const docFreq = new Map<string, number>()

  if (pageCount > 0) {
    for (const page of allPagesText) {
      for (const token of new Set(tokenize(page))) {
        docFreq.set(token, (docFreq.get(token) ?? 0) + 1)
      }
    }
  }

  const rarity = (term: string): number => {
    if (pageCount === 0) return 1
    const df = Math.max(docFreq.get(term) ?? 1, 1)
    return 1 + Math.log(pageCount / df)
  }

  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, weight: Math.sqrt(count) * rarity(term) }))
    .sort((a, b) => b.weight - a.weight || b.term.length - a.term.length || a.term.localeCompare(b.term))
    .slice(0, MAX_KEY_TERMS)
}

export interface RawSegment {
  text: string
  offset: number
  duration: number
}

export interface Segment {
  start: number
  end: number
  text: string
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function cleanCaptionText(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/&gt;&gt;|>>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeSegments(raw: RawSegment[], videoDurationSeconds?: number | null): Segment[] {
  const usable = raw.filter(
    (segment) => typeof segment.text === 'string' && Number.isFinite(segment.offset) && Number.isFinite(segment.duration)
  )
  if (!usable.length) return []

  const medianDuration = median(usable.map((segment) => segment.duration).filter((d) => d > 0))
  let divisor = medianDuration > 100 ? 1000 : 1

  if (divisor === 1 && videoDurationSeconds && videoDurationSeconds > 0) {
    const lastEnd = Math.max(...usable.map((segment) => segment.offset + segment.duration))
    if (lastEnd > videoDurationSeconds * 5) divisor = 1000
  }

  return usable
    .map((segment) => ({
      start: segment.offset / divisor,
      end: (segment.offset + segment.duration) / divisor,
      text: cleanCaptionText(segment.text),
    }))
    .filter((segment) => segment.text.length > 0)
    .sort((a, b) => a.start - b.start)
}

export interface Chunk {
  start: number
  end: number
  text: string
  terms: Set<string>
}

export function chunkSegments(segments: Segment[], targetWords = CHUNK_TARGET_WORDS): Chunk[] {
  const chunks: Chunk[] = []
  let current: Segment[] = []
  let words = 0

  const flush = () => {
    if (!current.length) return
    const text = current.map((segment) => segment.text).join(' ')
    chunks.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text,
      terms: new Set(tokenize(text)),
    })
    current = []
    words = 0
  }

  for (const segment of segments) {
    current.push(segment)
    words += countWords(segment.text)
    if (words >= targetWords) flush()
  }

  if (current.length) {
    const tailWords = words
    if (tailWords < targetWords / 3 && chunks.length > 0) {
      const last = chunks.pop() as Chunk
      const merged = [last.text, ...current.map((segment) => segment.text)].join(' ')
      chunks.push({
        start: last.start,
        end: current[current.length - 1].end,
        text: merged,
        terms: new Set(tokenize(merged)),
      })
      current = []
    } else {
      flush()
    }
  }

  return chunks
}

function coverageOf(keyTerms: KeyTerm[], present: Set<string>): number {
  let matched = 0
  let total = 0

  for (const { term, weight } of keyTerms) {
    total += weight
    if (present.has(term)) matched += weight
  }

  return total === 0 ? 0 : (matched / total) * 100
}

export interface LexicalResult {
  keywordPercent: number
  bestStartSeconds: number
  bestEndSeconds: number
  bestPercent: number
  chunkPercents: number[]
}

export function scoreLexical(keyTerms: KeyTerm[], chunks: Chunk[]): LexicalResult | null {
  if (keyTerms.length < MIN_KEY_TERMS || !chunks.length) return null

  const totalWords = chunks.reduce((sum, chunk) => sum + countWords(chunk.text), 0)
  if (totalWords < MIN_TRANSCRIPT_WORDS) return null

  const all = new Set<string>()
  for (const chunk of chunks) chunk.terms.forEach((term) => all.add(term))

  const chunkPercents = chunks.map((chunk) => coverageOf(keyTerms, chunk.terms))

  let bestStart = chunks[0].start
  let bestEnd = chunks[0].end
  let bestPercent = -1

  for (let i = 0; i < chunks.length; i++) {
    const window = new Set<string>(chunks[i].terms)
    let end = chunks[i].end

    if (i + 1 < chunks.length) {
      chunks[i + 1].terms.forEach((term) => window.add(term))
      end = chunks[i + 1].end
    }

    const percent = coverageOf(keyTerms, window)
    if (percent > bestPercent) {
      bestPercent = percent
      bestStart = chunks[i].start
      bestEnd = end
    }
  }

  return {
    keywordPercent: Math.round(coverageOf(keyTerms, all)),
    bestStartSeconds: Math.floor(bestStart),
    bestEndSeconds: Math.ceil(bestEnd),
    bestPercent: Math.round(bestPercent),
    chunkPercents,
  }
}

export function pickTopChunkIndexes(chunkPercents: number[], count: number): number[] {
  return chunkPercents
    .map((percent, index) => ({ percent, index }))
    .sort((a, b) => b.percent - a.percent || a.index - b.index)
    .slice(0, Math.max(count, 0))
    .map((entry) => entry.index)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function cosineToPercent(cosine: number): number {
  const scaled = (cosine - COSINE_FLOOR) / (COSINE_CEILING - COSINE_FLOOR)
  return Math.round(Math.min(Math.max(scaled, 0), 1) * 100)
}

export function semanticPercentFromCosines(cosines: number[]): number | null {
  if (!cosines.length) return null

  const top = [...cosines].sort((a, b) => b - a).slice(0, 2)
  const mean = top.reduce((sum, value) => sum + value, 0) / top.length

  return cosineToPercent(mean)
}

export function blendScores(keywordPercent: number | null, semanticPercent: number | null): number | null {
  if (keywordPercent === null) return null
  if (semanticPercent === null) return keywordPercent

  return Math.round(KEYWORD_BLEND_WEIGHT * keywordPercent + (1 - KEYWORD_BLEND_WEIGHT) * semanticPercent)
}
