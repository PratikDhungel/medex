import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { cartKey, removeLine as deleteLine, selectLineDuration } from '@/api/cart'
import { ApiError } from '@/api/client'
import { withoutLine } from '@/domain/cart/overlay'
import type { RawCart } from '@/domain/cart/raw'
import { useCartSync, writeCart } from './useCartSync'

export interface CartActions {
  /** Resolves once the server has saved the duration; rejects with an ApiError */
  selectDuration: (lineId: string, optionId: string) => Promise<void>
  /** Resolves once the server has removed the line; rejects with an ApiError */
  removeLine: (lineId: string) => Promise<void>
}

/**
 * The cart on screen may be wrong after these failures: the request may have
 * gone through (lost connection), or the line or option changed underneath.
 */
function needsReload(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === 'network' || error.status === 404 || error.status === 409)
}

/**
 * Cart writes other than quantities. Both first cancel any cart reload in
 * flight, so a reload that started earlier can't land afterwards and bring
 * back the old state.
 */
export function useCartActions(): CartActions {
  const queryClient = useQueryClient()
  const { writes, quantities } = useCartSync()

  return useMemo(() => {
    const reloadOnFailure = async <T>(request: () => Promise<T>): Promise<T> => {
      await queryClient.cancelQueries({ queryKey: cartKey, exact: true })
      try {
        return await request()
      } catch (error) {
        if (needsReload(error)) void queryClient.invalidateQueries({ queryKey: cartKey, exact: true })
        throw error
      }
    }

    return {
      selectDuration: async (lineId, optionId) => {
        await reloadOnFailure(() => writeCart(queryClient, writes, () => selectLineDuration(lineId, optionId)))
      },

      removeLine: async (lineId) => {
        // DELETE returns no cart, so the line is taken out of the cached one.
        // Taking a sequence number still stops older responses from bringing it back.
        const seq = writes.begin()
        await reloadOnFailure(() => deleteLine(lineId))
        writes.accept(seq)
        quantities.forget(lineId)
        queryClient.setQueryData<RawCart>(cartKey, (cart) => (cart ? withoutLine(cart, lineId) : cart))
      },
    }
  }, [queryClient, writes, quantities])
}
