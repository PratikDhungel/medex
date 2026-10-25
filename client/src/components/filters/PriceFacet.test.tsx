import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { facetOption } from '@/domain/filters'
import { PriceFacet } from './PriceFacet'

const noop = () => {}

const render = (currency: string | null, min: number | null = null, max: number | null = null, clearable = true) =>
  renderToStaticMarkup(
    <PriceFacet
      currencies={[
        facetOption('THB', 'THB', 1900, currency === 'THB'),
        facetOption('NPR', 'NPR', 600, currency === 'NPR'),
        facetOption('INR', 'INR', 0, currency === 'INR'),
      ]}
      currency={currency}
      clearable={clearable}
      onCurrencyChange={noop}
      bounds={currency ? { currency, min: 120, max: 45000 } : null}
      min={min}
      max={max}
      onRangeChange={noop}
    />,
  )

describe('PriceFacet', () => {
  it('asks for a currency before offering a range', () => {
    const html = render(null)
    expect(html).toContain('role="radiogroup"')
    expect(html.match(/type="radio"/g)).toHaveLength(3)
    expect(html).toContain('Choose a currency to set a price range.')
    expect(html).not.toContain('Min (')
  })

  it('offers a range in the chosen currency, hinting at the matching prices', () => {
    const html = render('THB')
    expect(html).toContain('Min (THB)')
    expect(html).toContain('placeholder="45,000"')
    expect(html).toContain('Matching services cost THB 120 to THB 45,000.')
    expect(html).toContain('Any currency')
  })

  it('offers no "Any currency" for a preselected currency', () => {
    expect(render('THB', null, null, false)).not.toContain('Any currency')
  })

  it('fills in the current range', () => {
    const html = render('THB', 500, 2000)
    expect(html).toContain('value="500"')
    expect(html).toContain('value="2000"')
  })

  it('disables currencies with no matching services', () => {
    expect(render(null).match(/disabled=""/g)).toHaveLength(1)
  })
})
