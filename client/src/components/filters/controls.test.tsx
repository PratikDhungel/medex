import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { facetOption } from '@/domain/filters'
import { FacetCheckboxList } from './FacetCheckbox'
import { FilterSection } from './FilterSection'
import { SearchBox } from './SearchBox'
import { SortSelect } from './SortSelect'

const noop = () => {}

describe('FacetCheckboxList', () => {
  const html = renderToStaticMarkup(
    <FacetCheckboxList
      options={[
        facetOption('lab_test', 'Lab Tests', 1240, true),
        facetOption('package', 'Packages', 1, false),
        facetOption('insurance', 'Insurance', 0, false),
      ]}
      onChange={noop}
    />,
  )

  it('labels each checkbox with its count', () => {
    expect(html).toContain('Lab Tests')
    expect(html).toContain('1,240<span class="sr-only"> services</span>')
    expect(html).toContain('1<span class="sr-only"> service</span>')
  })

  it('checks selected options and disables empty ones', () => {
    expect(html.match(/checked=""/g)).toHaveLength(1)
    expect(html.match(/disabled=""/g)).toHaveLength(1)
  })
})

describe('FilterSection', () => {
  it('groups its controls under a legend', () => {
    const html = renderToStaticMarkup(<FilterSection title="Service type">x</FilterSection>)
    expect(html).toMatch(/<fieldset[^>]*>.*<legend[^>]*>Service type<\/legend>/)
  })
})

describe('SearchBox', () => {
  it('has an accessible name and only offers clearing with text entered', () => {
    const empty = renderToStaticMarkup(<SearchBox value="" onChange={noop} label="Search services" />)
    expect(empty).toContain('aria-label="Search services"')
    expect(empty).not.toContain('Clear search')
    expect(renderToStaticMarkup(<SearchBox value="thyroid" onChange={noop} label="Search services" />)).toContain(
      'aria-label="Clear search"',
    )
  })
})

describe('SortSelect', () => {
  it('lists every sort option with the current one selected', () => {
    const html = renderToStaticMarkup(<SortSelect value="price-asc" onChange={noop} />)
    expect(html).toContain('Sort by')
    expect(html.match(/<option /g)).toHaveLength(4)
    expect(html).toContain('<option value="price-asc" selected="">Price: low to high</option>')
  })
})
