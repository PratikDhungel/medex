import { useQuery } from '@tanstack/react-query'
import { useMemo, useSyncExternalStore } from 'react'
import { cartQuery } from '@/api/cart'
import type { Cart } from '@/domain/cart/model'
import { normaliseCart } from '@/domain/cart/normalise'
import { withQuantities } from '@/domain/cart/overlay'
import type { QuantitySnapshot } from '@/state/quantitySync'
import { deriveCartStatus, type CartStatus } from './cartStatus'
import { useCartSync } from './useCartSync'

export interface CartState {
  status: CartStatus
  /** Set whenever there's a cart to show, including while a reload is failing. Shows unsaved quantities. */
  cart: Cart | undefined
  /** Quantity changes being saved, and the last failure per line */
  local: QuantitySnapshot
  /** A reload is in flight after a failure */
  retrying: boolean
  retry: () => void
  /** `shown` is the quantity on screen when the customer asked for the change */
  setQuantity: (lineId: string, quantity: number, shown: number) => void
  dismissQuantityFailure: (lineId: string) => void
}

/** Quantities the customer changed, shown on top of the cached cart */
function useLocalQuantities(): QuantitySnapshot {
  const { quantities } = useCartSync()
  // Same snapshot on the server: static renders (tests) have no local changes either way
  return useSyncExternalStore(quantities.subscribe, quantities.getSnapshot, quantities.getSnapshot)
}

/** The logged-in customer's cart, normalised, with quantity changes applied as soon as they're made */
export function useCart(): CartState {
  const { quantities } = useCartSync()
  const local = useLocalQuantities()
  const query = useQuery(cartQuery)

  const cart = useMemo(
    () => (query.data ? normaliseCart(withQuantities(query.data, local.quantities)) : undefined),
    [query.data, local.quantities],
  )

  return {
    status: deriveCartStatus({
      status: query.status,
      fetchStatus: query.fetchStatus,
      hasData: query.data !== undefined,
      error: query.error,
    }),
    cart,
    local,
    retrying: query.isError && query.isFetching,
    retry: () => void query.refetch(),
    setQuantity: (lineId, quantity, shown) => quantities.set(lineId, quantity, shown),
    dismissQuantityFailure: (lineId) => quantities.dismissFailure(lineId),
  }
}

/** Item count for the header, including changes still being saved */
export function useCartItemCount(): number | undefined {
  const local = useLocalQuantities()
  const { data } = useQuery(cartQuery)
  return useMemo(
    () => (data ? normaliseCart(withQuantities(data, local.quantities)).itemCount : undefined),
    [data, local.quantities],
  )
}
