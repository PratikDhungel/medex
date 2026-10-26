import { describe, expect, it } from 'vitest'
import { normaliseCart } from '@/domain/cart/normalise'
import type { RawCartLine } from '@/domain/cart/raw'
import { focusTargetAfterRemoval, groupHeadingId, lineElementId } from './focus'

const line = (id: string): RawCartLine => ({
  id,
  quantity: 1,
  product: { id: `p-${id}`, title: id, type: 'lab_test', currency: 'THB', price: 100 },
})

const cart = normaliseCart({
  groups: [
    { type: 'package', items: [{ ...line('p1'), product: { ...line('p1').product, type: 'package' } }] },
    { type: 'lab_test', items: [line('a'), line('b'), line('c')] },
  ],
})

describe('focusTargetAfterRemoval', () => {
  it('moves to the next line in the group', () => {
    expect(focusTargetAfterRemoval(cart, 'a')).toBe(lineElementId('b'))
  })

  it('moves to the previous line when the last one is removed', () => {
    expect(focusTargetAfterRemoval(cart, 'c')).toBe(lineElementId('b'))
  })

  it('moves to the next group when a group empties', () => {
    expect(focusTargetAfterRemoval(cart, 'p1')).toBe(groupHeadingId('lab_test'))
  })

  it('moves to the previous group when the last group empties', () => {
    const lastGroupOnly = normaliseCart({
      groups: [
        { type: 'package', items: [{ ...line('p1'), product: { ...line('p1').product, type: 'package' } }] },
        { type: 'lab_test', items: [line('a')] },
      ],
    })
    expect(focusTargetAfterRemoval(lastGroupOnly, 'a')).toBe(groupHeadingId('package'))
  })

  it('falls back to the page heading when the cart empties', () => {
    expect(focusTargetAfterRemoval(normaliseCart({ groups: [{ type: 'lab_test', items: [line('a')] }] }), 'a')).toBeNull()
  })
})
