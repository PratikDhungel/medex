/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from '@/domain/catalog'
import { groupByProvider } from '@/domain/grouping'
import { ProviderCard } from './ProviderCard'

const catalog = buildCatalog(
  JSON.parse(
    readFileSync(new URL('../../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
  ) as RawCatalog,
)
const groups = groupByProvider(catalog.services, catalog.providers)

const render = (expanded: boolean, group = groups.find((g) => g.services.length > 3)!) =>
  renderToStaticMarkup(
    <ProviderCard group={group} categories={catalog.categories} expanded={expanded} onExpandedChange={() => {}} />,
  )

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0

describe('ProviderCard', () => {
  it('shows three services and a "View all" button when collapsed', () => {
    const group = groups.find((g) => g.services.length > 3)!
    const html = render(false, group)
    expect(count(html, /<li /g)).toBe(3)
    expect(html).toContain(`View all ${group.services.length} services`)
    expect(html).toContain('aria-expanded="false"')
  })

  it('lists every service with "Show fewer" when expanded', () => {
    const group = groups.find((g) => g.services.length > 3)!
    const html = render(true, group)
    expect(count(html, /<li /g)).toBe(group.services.length)
    expect(html).toContain('Show fewer')
  })

  it('has no "View all" button with three services or fewer', () => {
    // Every real provider has more than three, so trim one down
    const small = { ...groups[0], services: groups[0].services.slice(0, 2) }
    const html = render(false, small)
    expect(count(html, /<li /g)).toBe(2)
    expect(html).not.toContain('View all')
    expect(html).toContain('2 services')
  })

  it('strikes through the original price of a discounted service', () => {
    const service = catalog.services.find((s) => s.pricing.kind === 'fixed' && s.pricing.price.hasDiscount)!
    const group = { provider: catalog.providers.get(service.providerId)!, services: [service] }
    expect(render(false, group)).toMatch(/<span class="sr-only">Was <\/span><s>/)
  })

  it('shows wellness prices as "From" with their durations', () => {
    const service = catalog.services.find((s) => s.pricing.kind === 'tiers' && s.pricing.tiers.length > 1)!
    const group = { provider: catalog.providers.get(service.providerId)!, services: [service] }
    const html = render(false, group)
    expect(html).toContain('From </span>')
    expect(html).toMatch(/\d durations, \d+–\d+ min/)
  })

  it('shows unrated providers as having no reviews', () => {
    const group = groups.find((g) => g.provider.rating === null)!
    expect(group).toBeDefined()
    expect(render(false, group)).toContain('No reviews yet')
  })
})
