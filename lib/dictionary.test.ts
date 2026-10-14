import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanHtml,
  clearDictionaryCache,
  lemmaCandidates,
  lookupWord,
  normalizeLookupTerm,
  parseDatamuse,
  parseFreeDictionary,
  parseWiktionary,
} from './dictionary'

const WIKTIONARY_CELL = {
  en: [
    {
      partOfSpeech: 'Noun',
      language: 'English',
      definitions: [
        {
          definition:
            'A <a rel="mw:WikiLink" href="./small" title="small">small</a> room in a <a href="./prison">prison</a> &amp; similar&nbsp;places.',
          parsedExamples: [{ example: 'The <b>cell</b> was cold.' }],
          examples: ['The <b>cell</b> was cold.'],
        },
        { definition: 'The basic unit of life.', examples: ['Every <i>cell</i> has a membrane.'] },
        { definition: '' },
      ],
    },
    {
      partOfSpeech: 'Noun',
      language: 'English',
      definitions: [{ definition: 'A battery.<sup>[1]</sup>' }],
    },
    { partOfSpeech: 'Verb', language: 'English', definitions: [{ definition: 'To confine in a cell.' }] },
  ],
  fr: [{ partOfSpeech: 'Verb', language: 'French', definitions: [{ definition: 'should be ignored' }] }],
}

const FREE_DICTIONARY_CELL = [
  {
    word: 'cell',
    phonetic: '/sɛl/',
    phonetics: [{ text: '/sɛl/' }],
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [
          { definition: 'A small room.', example: 'He sat in his cell.' },
          { definition: 'The smallest unit of life.' },
        ],
      },
      { partOfSpeech: 'verb', definitions: [{ definition: '' }] },
    ],
  },
]

const DATAMUSE_CELL = [
  { word: 'cello', score: 90, defs: ['n\ta bass instrument'] },
  { word: 'cell', score: 100, defs: ['n\tthe basic structural unit of life', 'n\ta small room', 'v\tconfine in a cell', 'u\tmystery'] },
]

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function hang(init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
  })
}

function makeFetch(handlers: { wiktionary?: Handler; free?: Handler; datamuse?: Handler }) {
  const calls: { host: string; term: string; headers: Record<string, string> }[] = []

  const impl = (async (input: any, init?: RequestInit) => {
    const url = new URL(String(input))
    const term =
      url.hostname === 'api.datamuse.com'
        ? (url.searchParams.get('sp') ?? '')
        : decodeURIComponent(url.pathname.split('/').pop() ?? '')
    calls.push({ host: url.hostname, term, headers: (init?.headers ?? {}) as Record<string, string> })

    const handler =
      url.hostname === 'en.wiktionary.org' ? handlers.wiktionary : url.hostname === 'api.dictionaryapi.dev' ? handlers.free : handlers.datamuse

    if (!handler) return jsonResponse({}, 404)
    return handler(url, init)
  }) as typeof fetch

  return { impl, calls }
}

const quiet = (fn: () => Promise<void>) => async () => {
  const original = console.error
  console.error = () => {}
  try {
    await fn()
  } finally {
    console.error = original
  }
}

test('normalizeLookupTerm cleans selections from PDF text and rejects junk', () => {
  assert.equal(normalizeLookupTerm('cell'), 'cell')
  assert.equal(normalizeLookupTerm('  Cell, '), 'Cell')
  assert.equal(normalizeLookupTerm('(membrane).'), 'membrane')
  assert.equal(normalizeLookupTerm('“mitochondria”'), 'mitochondria')
  assert.equal(normalizeLookupTerm('don’t'), "don't")
  assert.equal(normalizeLookupTerm('well-known'), 'well-known')
  assert.equal(normalizeLookupTerm('cell   membrane'), 'cell membrane')
  assert.equal(normalizeLookupTerm('cell\nmembrane'), 'cell membrane')

  assert.equal(normalizeLookupTerm(''), null)
  assert.equal(normalizeLookupTerm('   '), null)
  assert.equal(normalizeLookupTerm('1234'), null)
  assert.equal(normalizeLookupTerm('H2O'), null)
  assert.equal(normalizeLookupTerm('a b c d'), null)
  assert.equal(normalizeLookupTerm('x'.repeat(50)), null)
  assert.equal(normalizeLookupTerm('e=mc^2'), null)
})

test('lemmaCandidates proposes sensible base forms', () => {
  assert.ok(lemmaCandidates('cells').includes('cell'))
  assert.ok(lemmaCandidates('studies').includes('study'))
  assert.ok(lemmaCandidates('studied').includes('study'))
  assert.ok(lemmaCandidates('boxes').includes('box'))
  assert.ok(lemmaCandidates('running').includes('run'))
  assert.ok(lemmaCandidates('produced').includes('produce'))
  assert.ok(lemmaCandidates('producing').includes('produce'))
  assert.ok(lemmaCandidates('quickly').includes('quick'))

  assert.deepEqual(lemmaCandidates('cell membrane'), [])
  assert.deepEqual(lemmaCandidates('cat'), [])
  assert.ok(!lemmaCandidates('cells').includes('cells'))
  assert.ok(lemmaCandidates('processes').length <= 5)
})

test('cleanHtml strips tags, decodes entities and keeps words intact', () => {
  assert.equal(cleanHtml('<a href="x">small</a>s &amp; <b>big</b>&nbsp;ones'), 'smalls & big ones')
  assert.equal(cleanHtml('one<br>two'), 'one two')
  assert.equal(cleanHtml('<ul><li>a</li><li>b</li></ul>'), 'a b')
  assert.equal(cleanHtml('caf&#233; &#x41; &unknown;'), 'café A &unknown;')
  assert.equal(cleanHtml('text<sup>[1]</sup>'), 'text')
})

test('parseWiktionary keeps English only, merges parts of speech and cleans text', () => {
  const entry = parseWiktionary(WIKTIONARY_CELL, 'cell')!

  assert.equal(entry.source, 'wiktionary')
  assert.deepEqual(entry.meanings.map((m) => m.partOfSpeech), ['noun', 'verb'])

  const noun = entry.meanings[0]
  assert.equal(noun.definitions.length, 3)
  assert.equal(noun.definitions[0].definition, 'A small room in a prison & similar places.')
  assert.equal(noun.definitions[0].example, 'The cell was cold.')
  assert.equal(noun.definitions[1].example, 'Every cell has a membrane.')
  assert.equal(noun.definitions[2].definition, 'A battery.')
  assert.ok(!JSON.stringify(entry).includes('ignored'))
})

test('parseWiktionary returns null for empty, missing or malformed data', () => {
  assert.equal(parseWiktionary({}, 'x'), null)
  assert.equal(parseWiktionary(null, 'x'), null)
  assert.equal(parseWiktionary({ en: [] }, 'x'), null)
  assert.equal(parseWiktionary({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: '  ' }] }] }, 'x'), null)
  assert.equal(parseWiktionary({ title: 'Not found.', type: 'not_found' }, 'x'), null)
})

test('parseFreeDictionary reads phonetics, definitions and examples', () => {
  const entry = parseFreeDictionary(FREE_DICTIONARY_CELL, 'cell')!

  assert.equal(entry.source, 'freedictionary')
  assert.equal(entry.phonetic, '/sɛl/')
  assert.equal(entry.meanings.length, 1)
  assert.equal(entry.meanings[0].definitions[0].example, 'He sat in his cell.')
  assert.equal(parseFreeDictionary({ title: 'No Definitions Found' }, 'x'), null)
  assert.equal(parseFreeDictionary([], 'x'), null)
})

test('parseDatamuse matches the exact word, maps parts of speech and ignores near matches', () => {
  const entry = parseDatamuse(DATAMUSE_CELL, 'cell')!

  assert.equal(entry.source, 'datamuse')
  assert.equal(entry.word, 'cell')
  assert.deepEqual(entry.meanings.map((m) => m.partOfSpeech), ['noun', 'verb', 'definition'])
  assert.equal(entry.meanings[0].definitions.length, 2)

  assert.equal(parseDatamuse([{ word: 'cello', defs: ['n\tinstrument'] }], 'cell'), null)
  assert.equal(parseDatamuse([{ word: 'cell' }], 'cell'), null)
  assert.equal(parseDatamuse([], 'cell'), null)
})

test('lookupWord returns the first successful source and sends a descriptive User-Agent', async () => {
  const { impl, calls } = makeFetch({
    wiktionary: () => jsonResponse(WIKTIONARY_CELL),
    free: () => jsonResponse(FREE_DICTIONARY_CELL),
    datamuse: () => jsonResponse(DATAMUSE_CELL),
  })

  const result = await lookupWord('Cell,', { fetchImpl: impl, useCache: false })

  assert.equal(result.status, 'found')
  if (result.status === 'found') {
    assert.equal(result.lookedUp, 'cell')
    assert.ok(result.entry.meanings.length > 0)
  }

  const wiktionaryCall = calls.find((c) => c.host === 'en.wiktionary.org')!
  assert.match(wiktionaryCall.headers['User-Agent'], /StudyApp/)
  assert.ok(calls.every((c) => c.term === 'cell' || c.term === 'Cell'))
})

test('lookupWord still answers quickly when one source hangs and another fails', async () => {
  const { impl } = makeFetch({
    free: (_url, init) => hang(init),
    wiktionary: () => jsonResponse({}, 500),
    datamuse: () => jsonResponse(DATAMUSE_CELL),
  })

  const started = Date.now()
  const result = await lookupWord('cell', { fetchImpl: impl, useCache: false, timeoutMs: 2000 })

  assert.equal(result.status, 'found')
  if (result.status === 'found') assert.equal(result.entry.source, 'datamuse')
  assert.ok(Date.now() - started < 1000, 'must not wait for the hanging source')
})

test('lookupWord reports unavailable when every source is unreachable', quiet(async () => {
  const { impl } = makeFetch({
    wiktionary: () => {
      throw new Error('ENOTFOUND')
    },
    free: (_url, init) => hang(init),
    datamuse: () => jsonResponse({}, 503),
  })

  const result = await lookupWord('cell', { fetchImpl: impl, useCache: false, timeoutMs: 80 })
  assert.deepEqual(result, { status: 'unavailable' })
}))

test('lookupWord reports missing when sources answer but know nothing', async () => {
  const { impl } = makeFetch({
    wiktionary: () => jsonResponse({ type: 'not_found' }, 404),
    free: () => jsonResponse({ title: 'No Definitions Found' }, 404),
    datamuse: () => jsonResponse([]),
  })

  const result = await lookupWord('zzzzqx', { fetchImpl: impl, useCache: false })
  assert.deepEqual(result, { status: 'missing' })
})

test('a definite "not found" beats a failing source', async () => {
  const { impl } = makeFetch({
    wiktionary: () => jsonResponse({ type: 'not_found' }, 404),
    free: () => jsonResponse({}, 500),
    datamuse: () => {
      throw new Error('boom')
    },
  })

  const result = await lookupWord('zzzzqx', { fetchImpl: impl, useCache: false })
  assert.deepEqual(result, { status: 'missing' })
})

test('lookupWord falls back to the base form for plurals and verb forms', async () => {
  const known = new Set(['cell', 'produce'])
  const responder: Handler = (url) => {
    const term = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    return known.has(term) ? jsonResponse(WIKTIONARY_CELL) : jsonResponse({ type: 'not_found' }, 404)
  }
  const { impl } = makeFetch({
    wiktionary: responder,
    free: () => jsonResponse({ title: 'No Definitions Found' }, 404),
    datamuse: () => jsonResponse([]),
  })

  const plural = await lookupWord('cells', { fetchImpl: impl, useCache: false })
  assert.equal(plural.status, 'found')
  if (plural.status === 'found') {
    assert.equal(plural.lookedUp, 'cell')
    assert.equal(plural.original, 'cells')
  }

  const verb = await lookupWord('Producing', { fetchImpl: impl, useCache: false })
  assert.equal(verb.status, 'found')
  if (verb.status === 'found') assert.equal(verb.lookedUp, 'produce')
})

test('lookupWord handles multi-word selections and rejects unusable ones without any request', async () => {
  const { impl, calls } = makeFetch({ wiktionary: () => jsonResponse(WIKTIONARY_CELL) })

  const phrase = await lookupWord('cell membrane', { fetchImpl: impl, useCache: false })
  assert.equal(phrase.status, 'found')
  assert.ok(calls.some((c) => c.term === 'cell membrane'))

  const before = calls.length
  assert.deepEqual(await lookupWord('12345', { fetchImpl: impl, useCache: false }), { status: 'missing' })
  assert.deepEqual(await lookupWord('one two three four', { fetchImpl: impl, useCache: false }), { status: 'missing' })
  assert.equal(calls.length, before, 'no network calls for unusable input')
})

test('lookupWord caches answers but never caches an outage', quiet(async () => {
  clearDictionaryCache()

  const ok = makeFetch({ wiktionary: () => jsonResponse(WIKTIONARY_CELL) })
  await lookupWord('cell', { fetchImpl: ok.impl })
  const callsAfterFirst = ok.calls.length
  const again = await lookupWord('CELL', { fetchImpl: ok.impl })
  assert.equal(again.status, 'found')
  assert.equal(ok.calls.length, callsAfterFirst, 'second lookup served from cache')

  clearDictionaryCache()
  const down = makeFetch({
    wiktionary: () => {
      throw new Error('offline')
    },
    free: () => {
      throw new Error('offline')
    },
    datamuse: () => {
      throw new Error('offline')
    },
  })
  assert.deepEqual(await lookupWord('mitochondria', { fetchImpl: down.impl }), { status: 'unavailable' })

  const recovered = makeFetch({ wiktionary: () => jsonResponse(WIKTIONARY_CELL) })
  const retry = await lookupWord('mitochondria', { fetchImpl: recovered.impl })
  assert.equal(retry.status, 'found', 'an earlier outage must not be remembered')
  clearDictionaryCache()
}))

test('lookupWord tolerates malformed responses from every source', quiet(async () => {
  const bad = new Response('<html>blocked by firewall</html>', { status: 200 })
  const { impl } = makeFetch({
    wiktionary: () => bad.clone(),
    free: () => bad.clone(),
    datamuse: () => bad.clone(),
  })

  const result = await lookupWord('cell', { fetchImpl: impl, useCache: false })
  assert.deepEqual(result, { status: 'unavailable' })
}))
