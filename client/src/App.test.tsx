import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'

const renderAt = (path: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('routes', () => {
  it('renders the cart page at /cart and marks the cart link as current', () => {
    const html = renderAt('/cart')
    expect(html).toContain('Your cart')
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/cart"|<a[^>]*href="\/cart"[^>]*aria-current="page"/)
  })

  it('renders a not-found page with a way back for unknown paths', () => {
    const html = renderAt('/nope')
    expect(html).toContain('Page not found')
    expect(html).toContain('href="/"')
  })
})
