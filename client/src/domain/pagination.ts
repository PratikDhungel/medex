/** Page numbers to show, with null for a gap: 1 … 4 5 6 … 12 */
export function pageItems(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount))
  const pages = [...wanted].sort((a, b) => a - b)
  const items: (number | null)[] = []
  pages.forEach((p, i) => {
    const previous = pages[i - 1]
    // A gap of one page shows that page rather than an ellipsis
    if (previous !== undefined && p - previous === 2) items.push(previous + 1)
    else if (previous !== undefined && p - previous > 2) items.push(null)
    items.push(p)
  })
  return items
}
