import test from 'node:test'
import assert from 'node:assert/strict'
import {
  blendScores,
  chunkSegments,
  cosineSimilarity,
  cosineToPercent,
  extractKeyTerms,
  normalizeSegments,
  pickTopChunkIndexes,
  scoreLexical,
  semanticPercentFromCosines,
  stem,
  tokenize,
  COSINE_CEILING,
  COSINE_FLOOR,
  MAX_KEY_TERMS,
  type Segment,
} from './videoMatchCore'
import { embedTexts, scoreVideos, type ScoreDeps, type VideoToScore } from './videoMatch'

const SECTION_PAGES = [
  'Mitochondria are organelles that produce ATP through cellular respiration. ' +
    'Glycolysis occurs in the cytoplasm and feeds pyruvate into the mitochondrial matrix.',
  'The inner membrane contains the electron transport chain, which pumps protons across the membrane ' +
    'to create a gradient used by ATP synthase. Oxidative phosphorylation drives ATP production.',
  'The cell is the basic unit of life. Every cell has a membrane and cytoplasm.',
  'DNA stores genetic information. The cell copies DNA before division.',
  'Photosynthesis in chloroplasts converts light energy into glucose using chlorophyll.',
]

const GOOD_SENTENCES = [
  'today we look at the mitochondria and how it makes ATP through cellular respiration',
  'first glycolysis happens in the cytoplasm and produces pyruvate that enters the mitochondrial matrix',
  'then the electron transport chain pumps protons across the inner membrane',
  'that proton gradient is used by ATP synthase for oxidative phosphorylation and ATP production',
]

const WEAK_SENTENCES = [
  'plants use chloroplasts and chlorophyll for photosynthesis and sunlight',
  'the cell has a membrane and the mitochondria also exist somewhere inside',
  'we will mostly talk about leaves and roots and how gardens grow',
]

const UNRELATED_SENTENCES = [
  'the roman empire was ruled by emperors who commanded large armies',
  'roads connected the provinces and the fall of rome came in the fifth century',
  'historians still debate the causes of that decline',
]

const PARAPHRASE_SENTENCES = [
  'the powerhouse of the cell makes the energy currency from sugar',
  'inside the cytoplasm sugar is split and the energy currency is built across the membrane',
  'a proton gradient builds up and drives the energy currency machinery',
]

function segmentsFrom(sentences: string[], secondsPerSegment = 6, repeat = 8): Segment[] {
  const segments: Segment[] = []
  let time = 0
  for (let r = 0; r < repeat; r++) {
    for (const text of sentences) {
      segments.push({ start: time, end: time + secondsPerSegment, text })
      time += secondsPerSegment
    }
  }
  return segments
}

function toRaw(segments: Segment[], unit: 'seconds' | 'ms') {
  const factor = unit === 'ms' ? 1000 : 1
  return segments.map((s) => ({ text: s.text, offset: s.start * factor, duration: (s.end - s.start) * factor }))
}

const CONCEPTS: string[][] = [
  ['atp', 'energy', 'powerhouse', 'currency', 'respiration', 'mitochondria'],
  ['membrane', 'proton', 'protons', 'gradient', 'electron', 'chain', 'synthase'],
  ['glycolysis', 'pyruvate', 'cytoplasm', 'sugar', 'glucose'],
  ['roman', 'empire', 'emperors', 'rome', 'armies'],
  ['plants', 'photosynthesis', 'chloroplasts', 'sunlight', 'chlorophyll', 'leaves'],
]

function fakeEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/[^a-z0-9]+/)
  return CONCEPTS.map((group) => group.filter((word) => words.includes(word)).length + 0.001)
}

function makeDeps(
  transcripts: Record<string, Segment[] | null>,
  embedImpl?: (texts: string[]) => Promise<number[][] | null>
): ScoreDeps & { embedCalls: string[][]; fetchCalls: string[] } {
  const embedCalls: string[][] = []
  const fetchCalls: string[] = []

  return {
    embedCalls,
    fetchCalls,
    fetchSegments: async (videoId) => {
      fetchCalls.push(videoId)
      return transcripts[videoId] ?? null
    },
    embed: async (texts) => {
      embedCalls.push(texts)
      if (embedImpl) return embedImpl(texts)
      return texts.map(fakeEmbedding)
    },
  }
}

const VIDEOS: VideoToScore[] = [
  { id: 'good', durationSeconds: 200 },
  { id: 'weak', durationSeconds: 150 },
  { id: 'unrelated', durationSeconds: 150 },
  { id: 'nocaptions', durationSeconds: 300 },
]

test('tokenize drops stopwords and short words and stems plurals', () => {
  assert.deepEqual(tokenize('The cells are in the membranes and it is 42'), ['cell', 'membran'])
  assert.equal(stem('proteins'), 'protein')
  assert.equal(stem('stress'), 'stress')
  assert.equal(stem('studies'), 'study')
})

test('stem collapses common word forms to the same root', () => {
  const families = [
    ['produce', 'produces', 'produced', 'producing'],
    ['membrane', 'membranes'],
    ['study', 'studies', 'studied', 'studying'],
    ['process', 'processes', 'processed', 'processing'],
    ['oxidize', 'oxidizes', 'oxidized', 'oxidizing'],
    ['proton', 'protons'],
    ['box', 'boxes'],
    ['match', 'matches'],
    ['cell', 'cells'],
  ]

  for (const family of families) {
    const roots = new Set(family.map(stem))
    assert.equal(roots.size, 1, `${family.join(', ')} -> ${Array.from(roots).join(', ')}`)
  }

  assert.notEqual(stem('cell'), stem('cello'))
  assert.notEqual(stem('mitochondria'), stem('chondria'))
})

test('extractKeyTerms favours section-specific terms over document-wide terms', () => {
  const section = SECTION_PAGES.slice(0, 2).join('\n')
  const withDoc = extractKeyTerms(section, SECTION_PAGES)
  const withoutDoc = extractKeyTerms(section)

  const weightOf = (terms: typeof withDoc, term: string) => terms.find((t) => t.term === term)?.weight ?? 0

  const boost = (term: string) => weightOf(withDoc, term) / weightOf(withoutDoc, term)

  assert.ok(boost('proton') > boost('membran'), 'a term found on one page gets a bigger boost than one found on several')
  assert.ok(boost('proton') > boost('cytoplasm'), 'rare term should outweigh recurring term')
  assert.ok(withDoc.length > 0 && withDoc.length <= MAX_KEY_TERMS)
  assert.deepEqual(extractKeyTerms(section, SECTION_PAGES), withDoc)
})

test('extractKeyTerms caps the term list', () => {
  const big = Array.from({ length: 400 }, (_, i) => `concept${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i * 7) % 26))}x`).join(' ')
  assert.ok(extractKeyTerms(big).length <= MAX_KEY_TERMS)
})

test('normalizeSegments detects milliseconds vs seconds and cleans captions', () => {
  const base = segmentsFrom(GOOD_SENTENCES, 5, 2)
  const fromSeconds = normalizeSegments(toRaw(base, 'seconds'))
  const fromMs = normalizeSegments(toRaw(base, 'ms'))

  assert.equal(fromSeconds[1].start, 5)
  assert.equal(fromMs[1].start, 5)
  assert.equal(fromMs[fromMs.length - 1].end, fromSeconds[fromSeconds.length - 1].end)

  const messy = normalizeSegments([
    { text: '[Music]', offset: 0, duration: 4 },
    { text: '>> so welcome [Applause] back', offset: 4, duration: 4 },
    { text: 'second thing', offset: 2, duration: 2 },
  ])
  assert.deepEqual(messy.map((s) => s.text), ['second thing', 'so welcome back'])
  assert.ok(messy[0].start <= messy[1].start)
})

test('normalizeSegments uses the known video length to catch millisecond offsets', () => {
  const raw = [
    { text: 'one', offset: 0, duration: 40 },
    { text: 'two', offset: 40, duration: 40 },
    { text: 'three', offset: 80, duration: 40 },
  ]
  assert.equal(normalizeSegments(raw, 600)[2].start, 80)
  assert.ok(Math.abs(normalizeSegments(raw, 0.05)[2].start - 0.08) < 1e-9)
})

test('chunkSegments keeps order, time bounds and merges a tiny tail', () => {
  const segments = segmentsFrom(GOOD_SENTENCES, 6, 12)
  const chunks = chunkSegments(segments, 60)

  assert.ok(chunks.length > 1)
  assert.equal(chunks[0].start, 0)
  assert.equal(chunks[chunks.length - 1].end, segments[segments.length - 1].end)
  for (let i = 1; i < chunks.length; i++) assert.ok(chunks[i].start >= chunks[i - 1].end - 1e-9)
  assert.ok(chunks.every((chunk) => chunk.terms.size > 0))
})

test('scoreLexical ranks relevant > loosely related > unrelated', () => {
  const keyTerms = extractKeyTerms(SECTION_PAGES.slice(0, 2).join('\n'), SECTION_PAGES)
  const score = (sentences: string[]) => scoreLexical(keyTerms, chunkSegments(segmentsFrom(sentences)))

  const good = score(GOOD_SENTENCES)
  const weak = score(WEAK_SENTENCES)
  const unrelated = score(UNRELATED_SENTENCES)

  assert.ok(good && weak && unrelated)
  assert.ok(good.keywordPercent > weak.keywordPercent, `${good.keywordPercent} > ${weak.keywordPercent}`)
  assert.ok(weak.keywordPercent > unrelated.keywordPercent, `${weak.keywordPercent} > ${unrelated.keywordPercent}`)
  assert.equal(unrelated.keywordPercent, 0)
  assert.ok(good.keywordPercent >= 60, `expected a strong match, got ${good.keywordPercent}`)
})

test('scoreLexical returns null when there is too little to judge', () => {
  const keyTerms = extractKeyTerms(SECTION_PAGES.slice(0, 2).join('\n'), SECTION_PAGES)
  assert.equal(scoreLexical(keyTerms, []), null)
  assert.equal(scoreLexical([], chunkSegments(segmentsFrom(GOOD_SENTENCES))), null)
  assert.equal(scoreLexical(keyTerms.slice(0, 3), chunkSegments(segmentsFrom(GOOD_SENTENCES))), null)
  assert.equal(scoreLexical(keyTerms, chunkSegments([{ start: 0, end: 3, text: 'hello there friends' }])), null)
})

test('best segment points at the stretch where the key terms are actually spoken', () => {
  const keyTerms = extractKeyTerms(SECTION_PAGES.slice(0, 2).join('\n'), SECTION_PAGES)
  const filler = 'welcome back everyone we are chatting about cooking pasta tonight and the weather outside'
  const segments: Segment[] = []

  for (let i = 0; i < 150; i++) {
    const inRelevantStretch = i >= 100 && i < 120
    const text = inRelevantStretch ? GOOD_SENTENCES[i % GOOD_SENTENCES.length] : filler
    segments.push({ start: i * 6, end: i * 6 + 6, text })
  }

  const result = scoreLexical(keyTerms, chunkSegments(segments, 60))
  assert.ok(result)
  assert.ok(result.bestStartSeconds >= 540 && result.bestStartSeconds <= 720, `start ${result.bestStartSeconds}`)
  assert.ok(result.bestEndSeconds > 600 && result.bestEndSeconds <= 900, `end ${result.bestEndSeconds}`)
  assert.ok(result.bestPercent > result.keywordPercent - 1)
  assert.ok(result.bestPercent > 40)
})

test('pickTopChunkIndexes sorts by score and breaks ties by position', () => {
  assert.deepEqual(pickTopChunkIndexes([10, 50, 50, 5, 30], 3), [1, 2, 4])
  assert.deepEqual(pickTopChunkIndexes([1, 2], 5), [1, 0])
  assert.deepEqual(pickTopChunkIndexes([1, 2], 0), [])
})

test('cosineSimilarity and calibration behave sensibly', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1)
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0)
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1)
  assert.equal(cosineSimilarity([1, 2], [1]), 0)
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0)
  assert.ok(Math.abs(cosineSimilarity([2, 4], [1, 2]) - 1) < 1e-12)

  assert.equal(cosineToPercent(COSINE_FLOOR - 0.2), 0)
  assert.equal(cosineToPercent(COSINE_CEILING + 0.1), 100)
  assert.ok(cosineToPercent(0.6) < cosineToPercent(0.7))
  assert.equal(cosineToPercent((COSINE_FLOOR + COSINE_CEILING) / 2), 50)

  assert.equal(semanticPercentFromCosines([]), null)
  assert.equal(semanticPercentFromCosines([0.85, 0.85, 0.1]), 100)
  assert.equal(semanticPercentFromCosines([0.65]), cosineToPercent(0.65))
})

test('blendScores averages when both exist and falls back gracefully', () => {
  assert.equal(blendScores(60, 80), 70)
  assert.equal(blendScores(60, null), 60)
  assert.equal(blendScores(null, 80), null)
  assert.equal(blendScores(null, null), null)
  assert.equal(blendScores(0, 100), 50)
})

test('embedTexts sends the right request and parses vectors', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.GEMINI_API_KEY
  process.env.GEMINI_API_KEY = 'test-key'

  let seenUrl = ''
  let seenBody: any = null

  globalThis.fetch = (async (url: any, init: any) => {
    seenUrl = String(url)
    seenBody = JSON.parse(init.body)
    return new Response(
      JSON.stringify({ embeddings: seenBody.requests.map((_: unknown, i: number) => ({ values: [i + 1, 0, 1] })) }),
      { status: 200 }
    )
  }) as typeof fetch

  try {
    const vectors = await embedTexts(['alpha', 'beta'])
    assert.deepEqual(vectors, [
      [1, 0, 1],
      [2, 0, 1],
    ])
    assert.match(seenUrl, /gemini-embedding-001:batchEmbedContents\?key=test-key$/)
    assert.equal(seenBody.requests.length, 2)
    assert.equal(seenBody.requests[0].model, 'models/gemini-embedding-001')
    assert.equal(seenBody.requests[0].taskType, 'SEMANTIC_SIMILARITY')
    assert.equal(seenBody.requests[0].outputDimensionality, 768)
    assert.equal(seenBody.requests[1].content.parts[0].text, 'beta')
  } finally {
    globalThis.fetch = originalFetch
    process.env.GEMINI_API_KEY = originalKey
  }
})

test('embedTexts returns null instead of throwing on every failure mode', async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.GEMINI_API_KEY
  const originalError = console.error
  console.error = () => {}

  try {
    process.env.GEMINI_API_KEY = 'test-key'

    globalThis.fetch = (async () => new Response('quota', { status: 429 })) as typeof fetch
    assert.equal(await embedTexts(['x']), null)

    globalThis.fetch = (async () => new Response(JSON.stringify({ embeddings: [{ values: [1] }] }), { status: 200 })) as typeof fetch
    assert.equal(await embedTexts(['x', 'y']), null, 'count mismatch')

    globalThis.fetch = (async () => new Response(JSON.stringify({ nope: true }), { status: 200 })) as typeof fetch
    assert.equal(await embedTexts(['x']), null, 'bad shape')

    globalThis.fetch = (async () => new Response(JSON.stringify({ embeddings: [{ values: [] }] }), { status: 200 })) as typeof fetch
    assert.equal(await embedTexts(['x']), null, 'empty vector')

    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as typeof fetch
    assert.equal(await embedTexts(['x']), null, 'network error')

    assert.equal(await embedTexts([]), null, 'empty batch')
    assert.equal(await embedTexts(Array.from({ length: 101 }, () => 'x')), null, 'over batch limit')

    delete process.env.GEMINI_API_KEY
    assert.equal(await embedTexts(['x']), null, 'no api key')
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalError
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalKey
  }
})

test('scoreVideos ranks videos, handles missing captions and calls embeddings once', async () => {
  const deps = makeDeps({
    good: segmentsFrom(GOOD_SENTENCES),
    weak: segmentsFrom(WEAK_SENTENCES),
    unrelated: segmentsFrom(UNRELATED_SENTENCES),
    nocaptions: null,
  })

  const results = await scoreVideos(VIDEOS, SECTION_PAGES, 1, 2, deps)
  const good = results.get('good')!
  const weak = results.get('weak')!
  const unrelated = results.get('unrelated')!
  const none = results.get('nocaptions')!

  assert.ok(good.matchPercent! > weak.matchPercent!, `${good.matchPercent} > ${weak.matchPercent}`)
  assert.ok(weak.matchPercent! > unrelated.matchPercent!, `${weak.matchPercent} > ${unrelated.matchPercent}`)
  assert.ok(good.matchPercent! >= 70, `strong match expected, got ${good.matchPercent}`)
  assert.ok(unrelated.matchPercent! <= 10, `unrelated should be near zero, got ${unrelated.matchPercent}`)
  assert.equal(unrelated.bestStartSeconds, null, 'no best part for a video that never covers the text')
  assert.equal(unrelated.bestEndSeconds, null)

  assert.deepEqual(none, {
    matchPercent: null,
    keywordPercent: null,
    semanticPercent: null,
    bestStartSeconds: null,
    bestEndSeconds: null,
  })

  assert.equal(good.matchPercent, Math.round(0.5 * good.keywordPercent! + 0.5 * good.semanticPercent!))
  assert.ok(good.bestStartSeconds !== null && good.bestEndSeconds! > good.bestStartSeconds!)

  assert.equal(deps.embedCalls.length, 1, 'one batched embedding call')
  assert.ok(deps.embedCalls[0].length <= 100)
  assert.ok(deps.embedCalls[0][0].toLowerCase().includes('mitochondria'), 'first text is the section text')
  assert.ok(!deps.embedCalls[0][0].toLowerCase().includes('photosynthesis in chloroplasts converts'), 'section excludes other pages')
})

test('semantic score rescues a paraphrased explanation that keyword matching undervalues', async () => {
  const deps = makeDeps({ paraphrase: segmentsFrom(PARAPHRASE_SENTENCES) })
  const results = await scoreVideos([{ id: 'paraphrase', durationSeconds: 150 }], SECTION_PAGES, 1, 2, deps)
  const r = results.get('paraphrase')!

  assert.ok(r.keywordPercent! < 50, `keyword should be low, got ${r.keywordPercent}`)
  assert.ok(r.semanticPercent! > r.keywordPercent!, `semantic ${r.semanticPercent} > keyword ${r.keywordPercent}`)
  assert.ok(r.matchPercent! > r.keywordPercent!)
})

test('scoreVideos falls back to keyword-only when embeddings fail', async () => {
  const deps = makeDeps({ good: segmentsFrom(GOOD_SENTENCES) }, async () => null)
  const r = (await scoreVideos([VIDEOS[0]], SECTION_PAGES, 1, 2, deps)).get('good')!

  assert.equal(r.semanticPercent, null)
  assert.equal(r.matchPercent, r.keywordPercent)
  assert.ok(r.keywordPercent! > 0)
})

test('scoreVideos survives an embedding response of the wrong length', async () => {
  const deps = makeDeps({ good: segmentsFrom(GOOD_SENTENCES) }, async () => [[1, 2, 3]])
  const r = (await scoreVideos([VIDEOS[0]], SECTION_PAGES, 1, 2, deps)).get('good')!

  assert.equal(r.semanticPercent, null)
  assert.equal(r.matchPercent, r.keywordPercent)
})

test('scoreVideos does nothing when the pages have no readable text', async () => {
  const deps = makeDeps({ good: segmentsFrom(GOOD_SENTENCES) })
  const originalError = console.error
  console.error = () => {}

  try {
    const results = await scoreVideos([VIDEOS[0]], ['   ', '12 34 56'], 1, 2, deps)
    assert.equal(results.get('good')!.matchPercent, null)
    assert.equal(deps.fetchCalls.length, 0, 'no transcript requests wasted')
    assert.equal(deps.embedCalls.length, 0)
  } finally {
    console.error = originalError
  }
})

test('scoreVideos keeps the embedding batch under the 100 text limit for many videos', async () => {
  const many: VideoToScore[] = Array.from({ length: 40 }, (_, i) => ({ id: `v${i}`, durationSeconds: 300 }))
  const transcripts: Record<string, Segment[]> = {}
  many.forEach((v) => (transcripts[v.id] = segmentsFrom([...GOOD_SENTENCES, ...WEAK_SENTENCES], 6, 20)))

  const deps = makeDeps(transcripts)
  const results = await scoreVideos(many, SECTION_PAGES, 1, 2, deps)

  assert.equal(deps.embedCalls.length, 1)
  assert.ok(deps.embedCalls[0].length <= 100, `batch was ${deps.embedCalls[0].length}`)
  assert.ok(Array.from(results.values()).every((r) => r.matchPercent !== null))
})

test('scoreVideos is deterministic and works with millisecond caption timestamps', async () => {
  const base = segmentsFrom(GOOD_SENTENCES)
  const secondsDeps = makeDeps({ good: normalizeSegments(toRaw(base, 'seconds')) })
  const msDeps = makeDeps({ good: normalizeSegments(toRaw(base, 'ms')) })

  const a = (await scoreVideos([VIDEOS[0]], SECTION_PAGES, 1, 2, secondsDeps)).get('good')
  const b = (await scoreVideos([VIDEOS[0]], SECTION_PAGES, 1, 2, secondsDeps)).get('good')
  const c = (await scoreVideos([VIDEOS[0]], SECTION_PAGES, 1, 2, msDeps)).get('good')

  assert.deepEqual(a, b)
  assert.deepEqual(a, c)
})
