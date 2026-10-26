import type { SessionStorageLike } from '@/domain/checkout/storage'

/** localStorage, or a no-op stand-in where it isn't available (state then lasts only for the page load) */
export function browserStorage(): SessionStorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {
    // Some browsers throw on access in private mode
  }
  return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
}
