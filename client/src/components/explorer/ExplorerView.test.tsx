/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import { buildCatalog, type RawCatalog } from '@/domain/catalog'
import { groupByProvider } from '@/domain/grouping'
import { ExplorerView, type ExplorerViewProps } from './ExplorerView'

const raw = JSON.parse(
  readFileSync(new URL('../../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
) as RawCatalog
const catalog = buildCatalog(raw)
const groups = groupByProvider(catalog.services, catalog.providers)

const render = (overrides: Partial<ExplorerViewProps>) =>
  renderToStaticMarkup(
    <ExplorerView
      status={{ kind: 'ready', missing: [] }}
      catalog={catalog}
      groups={groups}
      totals={{ services: catalog.services.length, providers: groups.length }}
      mixedCurrencies={false}
      onClearFilters={() => {}}
      failures={[]}
      retrying={false}
      onRetry={() => {}}
      online
      slow={false}
      isExpanded={() => false}
      onExpandedChange={() => {}}
      {...overrides}
    />,
  )

const loading: Partial<ExplorerViewProps> = { status: { kind: 'loading' }, catalog: undefined, groups: [] }

describe('ExplorerView', () => {
  it('shows a card per provider and announces the count', () => {
    const html = render({})
    expect(html).toContain('<p role="status" aria-live="polite"')
    expect(html).toContain(`2,853 services from ${groups.length} providers`)
    expect(html.match(/role="article"/g)).toHaveLength(groups.length)
  })

  it('shows skeletons while loading, then says when it is slow', () => {
    const html = render(loading)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Loading services…')
    expect(render({ ...loading, slow: true })).toContain('This is taking longer than usual')
  })

  it('shows the error with a retry button', () => {
    const html = render({
      status: { kind: 'error', failed: ['services'] },
      catalog: undefined,
      groups: [],
      failures: [{ resource: 'services', error: new ApiError('http', '/service', 'boom', 500) }],
    })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Something went wrong on our side')
    expect(html).toContain('Try again')
  })

  it('disables retry while retrying', () => {
    const html = render({
      status: { kind: 'error', failed: ['services'] },
      failures: [{ resource: 'services', error: new ApiError('network', '/service', 'x') }],
      retrying: true,
    })
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Retrying…/)
  })

  it('shows the offline state when nothing could load', () => {
    expect(render({ status: { kind: 'offline' }, catalog: undefined, groups: [] })).toContain(
      'Services will load as soon as you&#x27;re back online',
    )
  })

  it('keeps results with a banner when going offline after loading', () => {
    const html = render({ online: false })
    expect(html).toContain('You&#x27;re offline. You can keep browsing')
    expect(html).toContain('role="article"')
  })

  it('shows partial results with a notice when categories are missing', () => {
    const partial = buildCatalog({ ...raw, categories: null })
    const html = render({
      status: { kind: 'ready', missing: ['categories'] },
      catalog: partial,
      groups: groupByProvider(partial.services, partial.providers),
    })
    expect(html).toContain('Categories couldn&#x27;t be loaded')
    expect(html).toContain('Try again')
    expect(html).toContain('role="article"')
  })

  it('offers a way out when nothing matches', () => {
    const html = render({ groups: [], totals: { services: 0, providers: 0 } })
    expect(html).toContain('No matching services')
    expect(html).toContain('No services match your search')
    expect(html).toContain('Clear search and filters')
  })

  it('explains a price sort across currencies', () => {
    expect(render({ mixedCurrencies: true })).toContain('sorted within each currency')
    expect(render({})).not.toContain('sorted within each currency')
  })
})
