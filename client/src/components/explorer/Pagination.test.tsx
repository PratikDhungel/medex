import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { pageItems } from '@/domain/pagination'
import { Pagination } from './Pagination'

describe('pageItems', () => {
  it('shows every page when there are few', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3])
    expect(pageItems(1, 1)).toEqual([1])
  })

  it('shows the ends and the neighbours, with gaps', () => {
    expect(pageItems(6, 12)).toEqual([1, null, 5, 6, 7, null, 12])
    expect(pageItems(1, 7)).toEqual([1, 2, null, 7])
  })

  it('shows a single missing page instead of an ellipsis', () => {
    expect(pageItems(4, 8)).toEqual([1, 2, 3, 4, 5, null, 8])
    expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('Pagination', () => {
  const render = (page: number, pageCount: number) =>
    renderToStaticMarkup(<Pagination page={page} pageCount={pageCount} hrefFor={(p) => `?page=${p}`} onPageChange={() => {}} />)

  it('renders nothing for a single page', () => {
    expect(render(1, 1)).toBe('')
  })

  it('uses real links and marks the current page', () => {
    const html = render(2, 7)
    expect(html).toContain('aria-label="Pagination"')
    expect(html).toContain('href="?page=1" aria-label="Previous page"')
    expect(html).toContain('href="?page=2" aria-label="Page 2" aria-current="page"')
    expect(html).toContain('href="?page=3" aria-label="Next page"')
  })

  it('has no previous link on the first page', () => {
    expect(render(1, 7)).not.toContain('Previous page')
  })
})
