import { CartView } from '@/components/cart/CartView'
import { useCart } from '@/hooks/useCart'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useElapsed } from '@/hooks/useElapsed'
import { useOnline } from '@/hooks/useOnline'
import { PageHeading } from './PageHeading'

/** How long loading may take before we say it's slow */
const SLOW_AFTER_MS = 3000

export function CartPage() {
  useDocumentTitle('Your cart')
  const { status, cart, retrying, retry } = useCart()
  const online = useOnline()
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)

  return (
    <>
      <PageHeading title="Your cart">Each group in your cart is booked and paid for separately.</PageHeading>
      <CartView status={status} cart={cart} online={online} slow={slow} retrying={retrying} onRetry={retry} />
    </>
  )
}
