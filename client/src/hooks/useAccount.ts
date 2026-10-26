import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { cartKey, mergeGuestCart } from '@/api/cart'
import { getGuestCartFixture } from '@/api/mock'
import { browserStorage } from '@/lib/browserStorage'
import { AccountStore, type AccountSnapshot } from '@/state/accountStore'

const stores = new WeakMap<QueryClient, AccountStore>()

function createStore(queryClient: QueryClient): AccountStore {
  const store = new AccountStore({
    storage: browserStorage(),
    merge: mergeGuestCart,
    fetchGuestFixture: getGuestCartFixture,
    // The merge returns the account's cart: show it without another request
    onMerged: (result) => queryClient.setQueryData(cartKey, result.cart),
    // A guest has no account cart; don't keep showing the last customer's
    onLoggedOut: () => queryClient.removeQueries({ queryKey: cartKey }),
  })
  // A failure leaves the guest cart unloaded; the guest view offers a retry
  if (store.getSnapshot().account === 'guest') store.ensureGuestCart().catch(() => {})
  return store
}

export function useAccountStore(): AccountStore {
  const queryClient = useQueryClient()
  let store = stores.get(queryClient)
  if (!store) {
    store = createStore(queryClient)
    stores.set(queryClient, store)
  }
  return store
}

export function useAccount(): AccountSnapshot {
  const store = useAccountStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export interface LogIn {
  logIn: () => void
  pending: boolean
  error: unknown
}

/** Logs in (merging the guest cart), then shows the cart with what changed */
export function useLogIn(): LogIn {
  const store = useAccountStore()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const logIn = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await store.logIn()
      navigate('/cart')
    } catch (failure) {
      setError(failure)
    } finally {
      setPending(false)
    }
  }

  return { logIn: () => void logIn(), pending, error }
}
