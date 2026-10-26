import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { cartKey } from '@/api/cart'
import { getOrder, placeOrder } from '@/api/orders'
import type { CheckoutSession } from '@/domain/checkout/machine'
import { browserStorage } from '@/lib/browserStorage'
import { CheckoutStore } from '@/state/checkoutStore'

const stores = new WeakMap<QueryClient, CheckoutStore>()

function createStore(queryClient: QueryClient): CheckoutStore {
  return new CheckoutStore({
    storage: browserStorage(),
    placeOrder,
    getOrder: (orderId) => getOrder(orderId),
    newKey: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
    onCartChanged: () => void queryClient.invalidateQueries({ queryKey: cartKey, exact: true }),
    isOnline: () => globalThis.navigator?.onLine !== false,
    onOnline: (callback) => globalThis.addEventListener?.('online', callback),
  })
}

/** The checkout store shared by every component using the same QueryClient */
export function useCheckoutStore(): CheckoutStore {
  const queryClient = useQueryClient()
  let store = stores.get(queryClient)
  if (!store) {
    store = createStore(queryClient)
    stores.set(queryClient, store)
  }
  return store
}

/** The current checkout session, or null when there isn't one */
export function useCheckoutSession(): CheckoutSession | null {
  const store = useCheckoutStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
