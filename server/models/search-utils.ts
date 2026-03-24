export type SearchArtifacts = {
  searchText: string
  searchPrefixes: string[]
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._+\- ]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function buildSearchArtifacts(values: Array<string | undefined | null>, maxPrefixes = 200): SearchArtifacts {
  const normalizedValues = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => normalizeToken(value))
    .filter(Boolean)

  const searchText = Array.from(new Set(normalizedValues)).join(' ')

  const prefixes = new Set<string>()
  const words = searchText.split(' ').filter(Boolean)

  for (const word of words) {
    const safeWord = word.slice(0, 32)
    const cap = Math.min(safeWord.length, 16)
    for (let index = 2; index <= cap; index += 1) {
      prefixes.add(safeWord.slice(0, index))
      if (prefixes.size >= maxPrefixes) break
    }
    if (prefixes.size >= maxPrefixes) break
  }

  return {
    searchText,
    searchPrefixes: Array.from(prefixes),
  }
}
