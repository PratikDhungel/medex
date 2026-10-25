/**
 * Folds text for matching a search query: lower case, accents removed and
 * whitespace collapsed, so "  São   Paulo" matches "sao paulo".
 */
export function normaliseSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en')
    .trim()
    .replace(/\s+/g, ' ')
}
