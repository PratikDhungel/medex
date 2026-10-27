import { describe, expect, it } from 'vitest'
import type { MergeResult } from '@/api/cart'
import { ApiError } from '@/api/client'
import type { RawGuestCartItem } from '@/domain/cart/raw'
import type { SessionStorageLike } from '@/domain/checkout/storage'
import { ACCOUNT_KEY, AccountStore, GUEST_CART_KEY } from './accountStore'

const fixture: RawGuestCartItem[] = [
  { productId: 'liver', quantity: 3 },
  { productId: 'facial', quantity: 1, wellnessPricingId: 'w90' },
]

function memoryStorage(initial: Record<string, string> = {}): SessionStorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

function setup(storage = memoryStorage(), merge?: (items: RawGuestCartItem[]) => Promise<MergeResult>) {
  const merged: RawGuestCartItem[][] = []
  let loggedOut = 0
  const store = new AccountStore({
    storage,
    merge:
      merge ??
      (async (items) => {
        merged.push(items)
        return { cart: { groups: [] }, changes: [{ kind: 'added', title: 'Lipid Profile' }] }
      }),
    fetchGuestFixture: async () => fixture,
    onMerged: () => {},
    onLoggedOut: () => void (loggedOut += 1),
  })
  return { store, storage, merged, loggedOut: () => loggedOut }
}

describe('AccountStore', () => {
  it('starts a first visit as a guest with the data file guest cart', async () => {
    const { store, storage } = setup()
    expect(store.getSnapshot()).toMatchObject({ account: 'guest', guestCart: null })
    await store.ensureGuestCart()
    expect(store.getSnapshot().guestCart).toEqual(fixture)
    expect(JSON.parse(storage.data.get(GUEST_CART_KEY)!)).toEqual(fixture)
  })

  it('merges the guest cart on login, empties it, and keeps what changed for the customer', async () => {
    const { store, storage, merged } = setup()
    await store.ensureGuestCart()
    await store.logIn()
    expect(merged).toEqual([fixture])
    expect(store.getSnapshot()).toEqual({
      account: 'customer',
      guestCart: [],
      guestCartFailed: false,
      mergeNotice: { changes: [{ kind: 'added', title: 'Lipid Profile' }] },
    })
    expect(storage.data.get(ACCOUNT_KEY)).toBe('customer')

    store.dismissMergeNotice()
    expect(store.getSnapshot().mergeNotice).toBeNull()
  })

  it('stays a guest with the cart intact when the merge fails', async () => {
    const { store } = setup(undefined, async () => {
      throw new ApiError('http', '/cart/merge', 'boom', 500)
    })
    await store.ensureGuestCart()
    await expect(store.logIn()).rejects.toBeInstanceOf(ApiError)
    expect(store.getSnapshot()).toMatchObject({ account: 'guest', guestCart: fixture })
  })

  it('does not reseed a guest cart that was merged, after logging out', async () => {
    const { store, loggedOut } = setup()
    await store.ensureGuestCart()
    await store.logIn()
    store.logOut()
    await store.ensureGuestCart()
    expect(store.getSnapshot()).toMatchObject({ account: 'guest', guestCart: [] })
    expect(loggedOut()).toBe(1)
  })

  it('skips the merge when the guest cart is empty', async () => {
    const { store, merged } = setup(memoryStorage({ [GUEST_CART_KEY]: '[]' }))
    await store.logIn()
    expect(merged).toEqual([])
    expect(store.getSnapshot()).toMatchObject({ account: 'customer', mergeNotice: null })
  })

  it('keeps only readable items from a stored guest cart', () => {
    const { store } = setup(memoryStorage({ [GUEST_CART_KEY]: JSON.stringify([{ productId: 'a', quantity: 1 }, { nope: true }]) }))
    expect(store.getSnapshot().guestCart).toEqual([{ productId: 'a', quantity: 1 }])
  })

  it('remembers a logged-in customer across page loads', () => {
    expect(setup(memoryStorage({ [ACCOUNT_KEY]: 'customer' })).store.getSnapshot().account).toBe('customer')
  })

  it('can start over as a first-time guest', async () => {
    const { store } = setup()
    await store.ensureGuestCart()
    await store.logIn()
    await store.resetToFirstVisit()
    expect(store.getSnapshot()).toMatchObject({ account: 'guest', guestCart: fixture })
  })

  it('reports a guest cart that failed to load, and loads it on retry', async () => {
    let calls = 0
    const store = new AccountStore({
      storage: memoryStorage(),
      merge: async () => ({ cart: { groups: [] }, changes: [] }),
      fetchGuestFixture: async () => {
        calls += 1
        if (calls === 1) throw new ApiError('network', '/__mock/guest-cart', 'lost')
        return fixture
      },
      onMerged: () => {},
      onLoggedOut: () => {},
    })
    await expect(store.ensureGuestCart()).rejects.toBeInstanceOf(ApiError)
    expect(store.getSnapshot()).toMatchObject({ guestCart: null, guestCartFailed: true })
    await store.ensureGuestCart()
    expect(store.getSnapshot()).toMatchObject({ guestCart: fixture, guestCartFailed: false })
  })
})
