export type DictionarySource = 'wiktionary' | 'freedictionary' | 'datamuse'

export interface DictionaryDefinition {
  definition: string
  example?: string
}

export interface DictionaryMeaning {
  partOfSpeech: string
  definitions: DictionaryDefinition[]
}

export interface DictionaryEntry {
  word: string
  phonetic?: string
  meanings: DictionaryMeaning[]
  source: DictionarySource
}

export type ProviderOutcome =
  | { status: 'found'; entry: DictionaryEntry }
  | { status: 'missing' }
  | { status: 'error'; reason: string }

export type LookupResult =
  | { status: 'found'; entry: DictionaryEntry; lookedUp: string; original: string }
  | { status: 'missing' }
  | { status: 'unavailable' }

export interface LookupOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  useCache?: boolean
}

const USER_AGENT = 'StudyApp/1.0 (https://github.com/Sybal667/Study; student study tool)'
const DEFAULT_TIMEOUT_MS = 5000
const MAX_WORDS = 3
const MAX_TERM_LENGTH = 40
const MAX_MEANINGS = 4
const MAX_DEFINITIONS_PER_MEANING = 3
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500

const cache = new Map<string, { at: number; result: LookupResult }>()

export function clearDictionaryCache(): void {
  cache.clear()
}

export function normalizeLookupTerm(raw: string): string | null {
  const cleaned = raw
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^A-Za-z]+/, '')
    .replace(/[^A-Za-z]+$/, '')

  if (!cleaned || cleaned.length > MAX_TERM_LENGTH) return null
  if (!/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/.test(cleaned)) return null
  if (cleaned.split(' ').length > MAX_WORDS) return null

  return cleaned
}

export function lemmaCandidates(term: string): string[] {
  const w = term.toLowerCase()
  if (w.includes(' ') || w.length < 4) return []

  const out: string[] = []
  const add = (candidate: string) => {
    if (candidate.length >= 2 && candidate !== w && !out.includes(candidate)) out.push(candidate)
  }

  if (w.endsWith('ies') && w.length > 4) add(w.slice(0, -3) + 'y')
  if (w.endsWith('ied') && w.length > 4) add(w.slice(0, -3) + 'y')
  if (/(s|x|z|ch|sh)es$/.test(w) && w.length > 4) add(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) add(w.slice(0, -1))

  for (const suffix of ['ing', 'ed']) {
    if (w.endsWith(suffix) && w.length > suffix.length + 2) {
      const base = w.slice(0, -suffix.length)
      add(base)
      add(base + 'e')
      if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) add(base.slice(0, -1))
    }
  }

  if (w.endsWith('ly') && w.length > 4) add(w.slice(0, -2))

  return out.slice(0, 5)
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

export function cleanHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/dd|\/dt)[^>]*>/gi, ' ')
      .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function mergeMeanings(meanings: DictionaryMeaning[]): DictionaryMeaning[] {
  const merged: DictionaryMeaning[] = []

  for (const meaning of meanings) {
    const existing = merged.find((m) => m.partOfSpeech === meaning.partOfSpeech)
    if (existing) {
      existing.definitions.push(...meaning.definitions)
    } else {
      merged.push({ partOfSpeech: meaning.partOfSpeech, definitions: [...meaning.definitions] })
    }
  }

  return merged
    .slice(0, MAX_MEANINGS)
    .map((m) => ({ ...m, definitions: m.definitions.slice(0, MAX_DEFINITIONS_PER_MEANING) }))
}

export function parseWiktionary(json: unknown, word: string): DictionaryEntry | null {
  const english = (json as { en?: unknown })?.en
  if (!Array.isArray(english)) return null

  const meanings: DictionaryMeaning[] = []

  for (const item of english as any[]) {
    if (!item || !Array.isArray(item.definitions)) continue

    const definitions: DictionaryDefinition[] = []

    for (const def of item.definitions) {
      const text = typeof def?.definition === 'string' ? cleanHtml(def.definition) : ''
      if (!text) continue

      const rawExample =
        typeof def?.parsedExamples?.[0]?.example === 'string'
          ? def.parsedExamples[0].example
          : typeof def?.examples?.[0] === 'string'
            ? def.examples[0]
            : ''
      const example = rawExample ? cleanHtml(rawExample) : ''

      definitions.push(example ? { definition: text, example } : { definition: text })
    }

    if (definitions.length) {
      meanings.push({
        partOfSpeech: String(item.partOfSpeech ?? 'definition').toLowerCase(),
        definitions,
      })
    }
  }

  const merged = mergeMeanings(meanings)
  return merged.length ? { word, meanings: merged, source: 'wiktionary' } : null
}

export function parseFreeDictionary(json: unknown, word: string): DictionaryEntry | null {
  if (!Array.isArray(json) || !json.length) return null

  const meanings: DictionaryMeaning[] = []
  let phonetic: string | undefined

  for (const entry of json as any[]) {
    if (!phonetic) {
      const fromList = Array.isArray(entry?.phonetics)
        ? entry.phonetics.find((p: any) => typeof p?.text === 'string' && p.text)?.text
        : undefined
      const candidate = typeof entry?.phonetic === 'string' && entry.phonetic ? entry.phonetic : fromList
      if (typeof candidate === 'string' && candidate) phonetic = candidate
    }

    for (const meaning of Array.isArray(entry?.meanings) ? entry.meanings : []) {
      const definitions: DictionaryDefinition[] = []

      for (const def of Array.isArray(meaning?.definitions) ? meaning.definitions : []) {
        const text = typeof def?.definition === 'string' ? def.definition.trim() : ''
        if (!text) continue
        const example = typeof def?.example === 'string' && def.example.trim() ? def.example.trim() : undefined
        definitions.push(example ? { definition: text, example } : { definition: text })
      }

      if (definitions.length) {
        meanings.push({ partOfSpeech: String(meaning?.partOfSpeech ?? 'definition').toLowerCase(), definitions })
      }
    }
  }

  const merged = mergeMeanings(meanings)
  if (!merged.length) return null

  return { word: typeof (json as any[])[0]?.word === 'string' ? (json as any[])[0].word : word, phonetic, meanings: merged, source: 'freedictionary' }
}

const DATAMUSE_POS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  u: 'definition',
}

export function parseDatamuse(json: unknown, term: string): DictionaryEntry | null {
  if (!Array.isArray(json)) return null

  const match = (json as any[]).find(
    (item) => typeof item?.word === 'string' && item.word.toLowerCase() === term.toLowerCase() && Array.isArray(item.defs)
  )
  if (!match) return null

  const meanings: DictionaryMeaning[] = []

  for (const raw of match.defs as unknown[]) {
    if (typeof raw !== 'string') continue
    const tab = raw.indexOf('\t')
    const code = tab === -1 ? 'u' : raw.slice(0, tab)
    const text = (tab === -1 ? raw : raw.slice(tab + 1)).trim()
    if (!text) continue
    meanings.push({ partOfSpeech: DATAMUSE_POS[code] ?? 'definition', definitions: [{ definition: text }] })
  }

  const merged = mergeMeanings(meanings)
  return merged.length ? { word: match.word, meanings: merged, source: 'datamuse' } : null
}

interface FetchContext {
  fetchImpl: typeof fetch
  timeoutMs: number
}

async function fetchJson(url: string, ctx: FetchContext): Promise<{ status: number; json: unknown } | { error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs)

  try {
    const res = await ctx.fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    })

    if (res.status === 404) return { status: 404, json: null }
    if (!res.ok) return { error: `HTTP ${res.status}` }

    return { status: res.status, json: await res.json() }
  } catch (err) {
    return { error: controller.signal.aborted ? 'timed out' : err instanceof Error ? err.message : 'network error' }
  } finally {
    clearTimeout(timer)
  }
}

type Provider = (term: string, ctx: FetchContext) => Promise<ProviderOutcome>

const wiktionaryProvider: Provider = async (term, ctx) => {
  const result = await fetchJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term)}`, ctx)
  if ('error' in result) return { status: 'error', reason: `wiktionary: ${result.error}` }
  const entry = result.status === 404 ? null : parseWiktionary(result.json, term)
  return entry ? { status: 'found', entry } : { status: 'missing' }
}

const freeDictionaryProvider: Provider = async (term, ctx) => {
  const result = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`, ctx)
  if ('error' in result) return { status: 'error', reason: `freedictionary: ${result.error}` }
  const entry = result.status === 404 ? null : parseFreeDictionary(result.json, term)
  return entry ? { status: 'found', entry } : { status: 'missing' }
}

const datamuseProvider: Provider = async (term, ctx) => {
  const result = await fetchJson(`https://api.datamuse.com/words?sp=${encodeURIComponent(term)}&md=d&max=5`, ctx)
  if ('error' in result) return { status: 'error', reason: `datamuse: ${result.error}` }
  const entry = result.status === 404 ? null : parseDatamuse(result.json, term)
  return entry ? { status: 'found', entry } : { status: 'missing' }
}

const PROVIDERS: Provider[] = [wiktionaryProvider, freeDictionaryProvider, datamuseProvider]

function firstFound(promises: Promise<ProviderOutcome>[]): Promise<ProviderOutcome> {
  return new Promise((resolve) => {
    let pending = promises.length
    let sawMissing = false
    let lastError = 'no providers'
    let done = false

    const settle = (outcome: ProviderOutcome) => {
      if (done) return

      if (outcome.status === 'found') {
        done = true
        resolve(outcome)
        return
      }

      if (outcome.status === 'missing') sawMissing = true
      else lastError = outcome.reason

      pending--
      if (pending === 0) {
        done = true
        resolve(sawMissing ? { status: 'missing' } : { status: 'error', reason: lastError })
      }
    }

    if (promises.length === 0) {
      resolve({ status: 'error', reason: lastError })
      return
    }

    promises.forEach((promise) =>
      promise.then(settle, (err) => settle({ status: 'error', reason: err instanceof Error ? err.message : 'failed' }))
    )
  })
}

async function lookupExact(term: string, ctx: FetchContext): Promise<ProviderOutcome> {
  return firstFound(PROVIDERS.map((provider) => provider(term, ctx)))
}

async function lookupFirstOf(terms: string[], ctx: FetchContext): Promise<{ term: string; outcome: ProviderOutcome } | null> {
  if (!terms.length) return null

  const outcomes = await Promise.all(terms.map((term) => lookupExact(term, ctx)))
  const found = outcomes.findIndex((outcome) => outcome.status === 'found')

  if (found !== -1) return { term: terms[found], outcome: outcomes[found] }

  const anyMissing = outcomes.some((outcome) => outcome.status === 'missing')
  return { term: terms[0], outcome: anyMissing ? { status: 'missing' } : outcomes[0] }
}

function readCache(key: string): LookupResult | null {
  const hit = cache.get(key)
  if (!hit) return null

  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }

  return hit.result
}

function writeCache(key: string, result: LookupResult): void {
  if (result.status === 'unavailable') return

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }

  cache.set(key, { at: Date.now(), result })
}

export async function lookupWord(raw: string, options: LookupOptions = {}): Promise<LookupResult> {
  const term = normalizeLookupTerm(raw)
  if (!term) return { status: 'missing' }

  const lower = term.toLowerCase()
  const useCache = options.useCache ?? true

  if (useCache) {
    const cached = readCache(lower)
    if (cached) return cached
  }

  const ctx: FetchContext = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }

  const exactTerms = term === lower ? [lower] : [lower, term]
  const stageOne = await lookupFirstOf(exactTerms, ctx)

  let result: LookupResult

  if (stageOne?.outcome.status === 'found') {
    result = { status: 'found', entry: stageOne.outcome.entry, lookedUp: stageOne.term, original: raw.trim() }
  } else {
    const stageTwo = await lookupFirstOf(lemmaCandidates(lower), ctx)

    if (stageTwo?.outcome.status === 'found') {
      result = { status: 'found', entry: stageTwo.outcome.entry, lookedUp: stageTwo.term, original: raw.trim() }
    } else {
      const sawMissing = stageOne?.outcome.status === 'missing' || stageTwo?.outcome.status === 'missing'
      result = sawMissing ? { status: 'missing' } : { status: 'unavailable' }

      if (result.status === 'unavailable') {
        const reason = [stageOne?.outcome, stageTwo?.outcome]
          .map((outcome) => (outcome?.status === 'error' ? outcome.reason : null))
          .filter(Boolean)
          .join('; ')
        console.error(`⚠️ Dictionary lookup unavailable for "${term}": ${reason}`)
      }
    }
  }

  if (useCache) writeCache(lower, result)
  return result
}
