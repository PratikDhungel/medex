import type { MergeResult } from '@/api/cart'
import type { RawGuestCartItem } from '@/domain/cart/raw'
import type { SessionStorageLike } from '@/domain/checkout/storage'

export type Account = 'guest' | 'customer'

export interface AccountSnapshot {
  account: Account
  /** What a guest has saved on this device; null until it has been loaded or seeded */
  guestCart: RawGuestCartItem[] | null
  /** Loading the guest cart failed; ensureGuestCart() tries again */
  guestCartFailed: boolean
  /** What the last login's merge changed, until the customer dismisses it */
  mergeNotice: { changes: MergeResult['changes'] } | null
}

export interface AccountStoreDeps {
  storage: SessionStorageLike
  merge: (items: RawGuestCartItem[]) => Promise<MergeResult>
  /** The guest cart from the data file, standing in for what a real guest saved */
  fetchGuestFixture: () => Promise<RawGuestCartItem[]>
  /** The merged cart from the server, to show straight away */
  onMerged: (result: MergeResult) => void
  onLoggedOut: () => void
}

export const ACCOUNT_KEY = 'medex.account'
export const GUEST_CART_KEY = 'medex.guestCart'

const isGuestItem = (value: unknown): value is RawGuestCartItem =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RawGuestCartItem).productId === 'string' &&
  typeof (value as RawGuestCartItem).quantity === 'number'

function read(storage: SessionStorageLike, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function write(storage: SessionStorageLike, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage unavailable: the state still holds for this page load
  }
}

/** A stored guest cart, keeping only readable items; null when nothing was ever stored */
function readGuestCart(storage: SessionStorageLike): RawGuestCartItem[] | null {
  const raw = read(storage, GUEST_CART_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isGuestItem) : []
  } catch {
    return []
  }
}

/**
 * A pretend login: there are no real accounts in this exercise. What matters
 * is the moment a guest becomes a customer: the cart saved on the device is
 * merged into the account's cart, and the customer is told what changed.
 */
export class AccountStore {
  private snapshot: AccountSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly deps: AccountStoreDeps
  private seeding: Promise<void> | null = null

  constructor(deps: AccountStoreDeps) {
    this.deps = deps
    // A first visit is a guest's
    const account: Account = read(deps.storage, ACCOUNT_KEY) === 'customer' ? 'customer' : 'guest'
    this.snapshot = { account, guestCart: readGuestCart(deps.storage), guestCartFailed: false, mergeNotice: null }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): AccountSnapshot => this.snapshot

  /** Gives a guest who has never had a cart on this device the one from the data file */
  async ensureGuestCart(): Promise<void> {
    if (this.snapshot.guestCart !== null) return
    if (this.snapshot.guestCartFailed) this.update({ guestCartFailed: false })
    this.seeding ??= this.deps
      .fetchGuestFixture()
      .then(
        (items) => this.setGuestCart(items),
        (error: unknown) => {
          this.update({ guestCartFailed: true })
          throw error
        },
      )
      .finally(() => {
        this.seeding = null
      })
    return this.seeding
  }

  /**
   * Merges the guest cart into the account's cart, then logs in. If the merge
   * fails nothing changes, and trying again is safe: the server's merge keeps
   * the larger quantity, so sending the same cart twice adds nothing twice.
   */
  async logIn(): Promise<void> {
    const items = this.snapshot.guestCart ?? []
    let mergeNotice: AccountSnapshot['mergeNotice'] = null
    if (items.length > 0) {
      const result = await this.deps.merge(items)
      this.deps.onMerged(result)
      mergeNotice = { changes: result.changes }
    }
    // The device's cart now lives in the account
    this.setGuestCart([])
    write(this.deps.storage, ACCOUNT_KEY, 'customer')
    this.update({ account: 'customer', mergeNotice })
  }

  logOut() {
    write(this.deps.storage, ACCOUNT_KEY, 'guest')
    this.update({ account: 'guest', mergeNotice: null })
    this.deps.onLoggedOut()
  }

  dismissMergeNotice() {
    this.update({ mergeNotice: null })
  }

  /** Starts over as a first-time guest, with the data file's guest cart (for the dev panel) */
  async resetToFirstVisit() {
    try {
      this.deps.storage.removeItem(GUEST_CART_KEY)
    } catch {
      // Nothing stored to remove
    }
    write(this.deps.storage, ACCOUNT_KEY, 'guest')
    this.update({ account: 'guest', guestCart: null, guestCartFailed: false, mergeNotice: null })
    this.deps.onLoggedOut()
    await this.ensureGuestCart()
  }

  private setGuestCart(items: RawGuestCartItem[]) {
    write(this.deps.storage, GUEST_CART_KEY, JSON.stringify(items))
    this.update({ guestCart: items })
  }

  private update(patch: Partial<AccountSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}
