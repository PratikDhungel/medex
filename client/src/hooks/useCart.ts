import { useQuery } from '@tanstack/react-query'
import { cartQuery } from '@/api/cart'
import type { Cart } from '@/domain/cart/model'
import { normaliseCart } from '@/domain/cart/normalise'
import { deriveCartStatus, type CartStatus } from './cartStatus'

export interface CartState {
  status: CartStatus
  /** Set whenever there's a cart to show, including while a reload is failing */
  cart: Cart | undefined
  /** A reload is in flight after a failure */
  retrying: boolean
  retry: () => void
}

/** The logged-in customer's cart, normalised. Re-normalises only when the server data changes. */
export function useCart(): CartState {
  const query = useQuery({ ...cartQuery, select: normaliseCart })

  return {
    status: deriveCartStatus({
      status: query.status,
      fetchStatus: query.fetchStatus,
      hasData: query.data !== undefined,
      error: query.error,
    }),
    cart: query.data,
    retrying: query.isError && query.isFetching,
    retry: () => void query.refetch(),
  }
}

/** Item count for the header, without normalising the whole cart */
export function useCartItemCount(): number | undefined {
  const { data } = useQuery({ ...cartQuery, select: (cart) => normaliseCart(cart).itemCount })
  return data
}
