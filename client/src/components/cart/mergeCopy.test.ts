import { describe, expect, it } from 'vitest'
import { describeMergeChanges } from './mergeCopy'

describe('describeMergeChanges', () => {
  it('explains the four overlaps in the data file', () => {
    // What POST /cart/merge returns for the guest cart in task2-cart.json
    expect(
      describeMergeChanges([
        { kind: 'kept_larger_quantity', title: 'Liver Function Profile', quantity: 3, accountQuantity: 2, guestQuantity: 3 },
        { kind: 'added', title: 'Lipid Profile', quantity: 1 },
        { kind: 'duration_applied', title: 'Signature Facial', durationInMinutes: 90 },
        { kind: 'not_offered', productId: '6b572fa4-4559-4dfd-a276-9c1400ce208e' },
      ]),
    ).toEqual([
      'Liver Function Profile: kept 3 from before you logged in (your account had 2).',
      'Lipid Profile added.',
      'Signature Facial: we used the 90 min you chose earlier.',
      '1 item you added before logging in is no longer offered, so it was not added.',
    ])
  })

  it('covers the edge cases the data does not contain', () => {
    expect(
      describeMergeChanges([
        { kind: 'added', title: 'Lipid Profile', quantity: 2 },
        { kind: 'already_in_cart', title: 'CBC Profile', quantity: 1 },
        { kind: 'duration_not_offered', title: 'Foot Reflexology' },
        { kind: 'quantity_capped', title: 'CBC Profile', requested: 50, quantity: 10 },
        { kind: 'not_offered' },
        { kind: 'not_offered' },
        { kind: 'invalid_item', index: 3 },
      ]),
    ).toEqual([
      'Lipid Profile (×2) added.',
      'CBC Profile was already in your cart.',
      'Foot Reflexology: the duration you chose is no longer offered. Please choose another.',
      'CBC Profile: you can book up to 10 at a time, so we kept that many.',
      '2 items you added before logging in are no longer offered, so they were not added.',
      "1 item from before you logged in couldn't be read, so it was not added.",
    ])
  })

  it('leaves out kinds it does not know and copes with missing fields', () => {
    expect(describeMergeChanges([{ kind: 'loyalty_points' }, { kind: 'added' }])).toEqual(['An item added.'])
  })
})
