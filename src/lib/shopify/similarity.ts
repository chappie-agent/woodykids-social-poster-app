// Title-based similarity: avoid showing variant-like duplicates in the same grid
// (e.g., the same drinkfles in 3 colors). Two titles are "too similar" when their
// meaningful word sets overlap above SIMILARITY_THRESHOLD.

const STOPWORDS = new Set([
  'voor', 'voor', 'mini', 'maxi', 'klein', 'groot', 'large', 'small', 'medium',
  'with', 'met', 'and', 'the', 'een', 'van', 'der', 'des', 'die', 'das',
  'kids', 'baby', 'kind', 'set', 'pack', 'paar',
])

const SIMILARITY_THRESHOLD = 0.4

export function tokenize(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  return new Set(tokens)
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersect = 0
  for (const w of a) if (b.has(w)) intersect++
  return intersect / (a.size + b.size - intersect)
}

export function isTooSimilar(candidate: Set<string>, existing: Set<string>[]): boolean {
  return existing.some(t => jaccard(candidate, t) > SIMILARITY_THRESHOLD)
}
