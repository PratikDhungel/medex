import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { facetOption, type CategoryFacetGroup } from '@/domain/filters'
import { CategoryFacet } from './CategoryFacet'
import { LocationFacet } from './LocationFacet'
import { COLLAPSED_PROVIDER_COUNT, ProviderFacet } from './ProviderFacet'

const noop = () => {}
const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0

// Mirrors the real data: an "Ultrasound" under two types, and two "Thyroid"s
const groups = (selected: { parent?: boolean; child?: boolean } = {}): CategoryFacetGroup[] => [
  {
    type: 'package',
    label: 'Packages',
    nodes: [{ option: facetOption('pkg-us', 'Ultrasound', 12, false), children: [facetOption('pkg-thy', 'Thyroid', 4, false)] }],
  },
  {
    type: 'lab_test',
    label: 'Lab Tests',
    nodes: [
      {
        option: facetOption('lab-us', 'Ultrasound', 30, selected.parent ?? false),
        children: [facetOption('lab-thy', 'Thyroid', 9, selected.child ?? false)],
      },
    ],
  },
]

describe('CategoryFacet', () => {
  it('puts same-named categories under their service type', () => {
    const html = renderToStaticMarkup(<CategoryFacet groups={groups()} available onChange={noop} />)
    expect(html).toMatch(/Packages.*Ultrasound.*Lab Tests.*Ultrasound/)
    expect(html).toContain('aria-label="Show Ultrasound subcategories"')
  })

  it('keeps subcategories collapsed unless one is selected', () => {
    const collapsed = renderToStaticMarkup(<CategoryFacet groups={groups()} available onChange={noop} />)
    expect(count(collapsed, /hidden=""/g)).toBe(2)
    const open = renderToStaticMarkup(<CategoryFacet groups={groups({ child: true })} available onChange={noop} />)
    expect(count(open, /hidden=""/g)).toBe(1)
    expect(open).toContain('aria-expanded="true"')
  })

  it('shows subcategories as included and locked under a selected parent', () => {
    const html = renderToStaticMarkup(<CategoryFacet groups={groups({ parent: true })} available onChange={noop} />)
    expect(count(html, /checked=""/g)).toBe(2)
    expect(count(html, /disabled=""/g)).toBe(1)
  })

  it('explains when categories are unavailable', () => {
    expect(renderToStaticMarkup(<CategoryFacet groups={[]} available={false} onChange={noop} />)).toContain(
      "Categories couldn&#x27;t be loaded.",
    )
  })
})

describe('LocationFacet', () => {
  it('lists cities under their country', () => {
    const html = renderToStaticMarkup(
      <LocationFacet
        groups={[{ country: facetOption('TH', 'Thailand', 900, false), cities: [facetOption('bangkok', 'Bangkok', 600, false)] }]}
        onCountryChange={noop}
        onCityChange={noop}
      />,
    )
    expect(html).toMatch(/Thailand.*Show Thailand cities.*Bangkok/)
  })
})

describe('ProviderFacet', () => {
  const providers = Array.from({ length: 12 }, (_, index) => facetOption(index + 1, `Clinic ${index + 1}`, 10, false))

  it('shows the first few providers with a "Show all" button', () => {
    const html = renderToStaticMarkup(<ProviderFacet options={providers} onChange={noop} />)
    expect(count(html, /type="checkbox"/g)).toBe(COLLAPSED_PROVIDER_COUNT)
    expect(html).toContain('Show all 12 providers')
    expect(html).toContain('aria-label="Search providers"')
  })

  it('moves selected providers to the top so they stay visible', () => {
    const options = providers.map((option) => (option.value === 12 ? facetOption(12, 'Clinic 12', 10, true) : option))
    const html = renderToStaticMarkup(<ProviderFacet options={options} onChange={noop} />)
    expect(html.indexOf('Clinic 12')).toBeLessThan(html.indexOf('Clinic 1<'))
  })

  it('needs no "Show all" for a short list', () => {
    const html = renderToStaticMarkup(<ProviderFacet options={providers.slice(0, 3)} onChange={noop} />)
    expect(html).not.toContain('Show all')
  })
})
