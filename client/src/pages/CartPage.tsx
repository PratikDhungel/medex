import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { CartView } from '@/components/cart/CartView'
import { lineTitle } from '@/components/cart/copy'
import { focusTargetAfterRemoval } from '@/components/cart/focus'
import { sessionSummaryText } from '@/components/checkout/copy'
import { checkoutHref } from '@/components/checkout/links'
import { hasUnresolved, summariseSession } from '@/domain/checkout/machine'
import { useCart } from '@/hooks/useCart'
import { useCartActions } from '@/hooks/useCartActions'
import { useCheckoutSession, useCheckoutStore } from '@/hooks/useCheckout'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useElapsed } from '@/hooks/useElapsed'
import { useOnline } from '@/hooks/useOnline'
import { PageHeading } from './PageHeading'

/** How long loading may take before we say it's slow */
const SLOW_AFTER_MS = 3000

/** Where focus should go once the cart re-renders: an element id, or the page heading */
type FocusRequest = { target: string | null }

export function CartPage() {
  useDocumentTitle('Your cart')
  const { status, cart, local, retrying, retry, setQuantity, dismissQuantityFailure } = useCart()
  const actions = useCartActions()
  const online = useOnline()
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)
  const session = useCheckoutSession()
  const checkout = useCheckoutStore()
  const navigate = useNavigate()
  const unresolved = session ? hasUnresolved(session) : false

  const [announcement, setAnnouncement] = useState('')
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const container = useRef<HTMLDivElement>(null)

  // Each request is a new object, so this runs once per removal, after the
  // render in which the removed line has left the DOM
  useEffect(() => {
    if (!focusRequest) return
    const { target } = focusRequest
    const element = target ? document.getElementById(target) : container.current?.querySelector('h1')
    element?.focus()
  }, [focusRequest])

  const removeLine = async (lineId: string) => {
    if (!cart) return
    // Decided before removal, while the line's neighbours are still known
    const target = focusTargetAfterRemoval(cart, lineId)
    const line = cart.groups.flatMap((group) => group.lines).find((l) => l.id === lineId)
    await actions.removeLine(lineId)
    setAnnouncement(`${line ? lineTitle(line) : 'The item'} was removed from your cart.`)
    setFocusRequest({ target })
  }

  return (
    <div ref={container} className="space-y-6">
      <PageHeading title="Your cart">Each group in your cart is booked and paid for separately.</PageHeading>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <CartView
        status={status}
        cart={cart}
        online={online}
        slow={slow}
        retrying={retrying}
        onRetry={retry}
        controls={{
          editable: online,
          local,
          onQuantityChange: setQuantity,
          onDismissFailure: dismissQuantityFailure,
          onSelectDuration: actions.selectDuration,
          onRemove: removeLine,
        }}
        booking={{
          blocked: unresolved,
          existing: session ? { text: sessionSummaryText(summariseSession(session)), unresolved } : null,
          onBook: (groupTypes) => {
            // A finished checkout makes way for the new one
            if (session && !unresolved) checkout.clear()
            navigate(checkoutHref(groupTypes))
          },
        }}
      />
    </div>
  )
}
