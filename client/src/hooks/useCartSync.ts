import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { cartKey, updateLineQuantity } from '@/api/cart'
import type { RawCart } from '@/domain/cart/raw'
import { CartWrites } from '@/state/cartWrites'
import { QuantitySync } from '@/state/quantitySync'

/** Client-side cart write state, shared by every component using the same QueryClient */
export interface CartSync {
  writes: CartWrites
  quantities: QuantitySync
}

const syncs = new WeakMap<QueryClient, CartSync>()

/** Puts a write's response in the cache, unless a later write's response is already there */
export async function writeCart(queryClient: QueryClient, writes: CartWrites, request: () => Promise<RawCart>) {
  const seq = writes.begin()
  const cart = await request()
  if (writes.accept(seq)) queryClient.setQueryData(cartKey, cart)
  return cart
}

/**
 * Reloads the cart once quantity changes have settled, then lets the server's
 * values replace the local ones. If the reload fails the local values stay:
 * they are the last ones the server confirmed.
 */
async function reconcile(queryClient: QueryClient, quantities: QuantitySync, mark: number) {
  const startedAt = Date.now()
  await queryClient.refetchQueries({ queryKey: cartKey, exact: true })
  if ((queryClient.getQueryState(cartKey)?.dataUpdatedAt ?? 0) >= startedAt) quantities.clearSettled(mark)
}

function createCartSync(queryClient: QueryClient): CartSync {
  const writes = new CartWrites()
  const quantities: QuantitySync = new QuantitySync({
    send: (lineId, quantity) => writeCart(queryClient, writes, () => updateLineQuantity(lineId, quantity)),
    onIdle: (mark) => void reconcile(queryClient, quantities, mark),
  })
  return { writes, quantities }
}

export function useCartSync(): CartSync {
  const queryClient = useQueryClient()
  let sync = syncs.get(queryClient)
  if (!sync) {
    sync = createCartSync(queryClient)
    syncs.set(queryClient, sync)
  }
  return sync
}
