import { CloudOff, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { failureMessage } from '@/api/failureMessage'
import { LogInButton } from '@/components/account/LogInButton'
import { ReviewView } from '@/components/checkout/ReviewView'
import { SessionView } from '@/components/checkout/SessionView'
import { orderHeadingId } from '@/components/checkout/links'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { CartGroup } from '@/domain/cart/model'
import { checkoutItems } from '@/domain/cart/summary'
import type { PaymentMethod } from '@/domain/checkout/model'
import { useAccount } from '@/hooks/useAccount'
import { useCart } from '@/hooks/useCart'
import { useCheckoutSession, useCheckoutStore } from '@/hooks/useCheckout'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOnline } from '@/hooks/useOnline'
import { PageHeading } from './PageHeading'

const orderFrom = (group: CartGroup, paymentMethod: PaymentMethod) => ({
  groupType: group.type,
  providers: group.providers.map((provider) => provider.name),
  items: checkoutItems(group),
  totals: group.subtotals,
  paymentMethod,
})

export function CheckoutPage() {
  useDocumentTitle('Checkout')
  const { account } = useAccount()
  if (account === 'guest') {
    return (
      <div className="space-y-6">
        <PageHeading title="Checkout" />
        <StatePanel icon={ShoppingCart} title="Log in to book" action={<LogInButton />}>
          Booking needs an account. The items saved on this device will be added to your cart.
        </StatePanel>
      </div>
    )
  }
  return <CustomerCheckout />
}

function CustomerCheckout() {
  const session = useCheckoutSession()
  const store = useCheckoutStore()
  const { status, cart, retrying, retry } = useCart()
  const online = useOnline()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [methods, setMethods] = useState<Record<string, PaymentMethod>>({})
  const sessionHeading = useRef<HTMLHeadingElement>(null)

  const requested = useMemo(() => (params.get('groups') ?? '').split(',').filter(Boolean), [params])
  const groups = new Map(cart?.groups.map((group) => [group.type, group]))
  const ready = requested.flatMap((type) => (groups.get(type)?.ready ? [groups.get(type)!] : []))
  const skipped = requested.filter((type) => !groups.get(type)?.ready).map((type) => ({ type, group: groups.get(type) }))
  const methodFor = (type: string): PaymentMethod => methods[type] ?? 'card'

  // Moving from review to results: start the customer at the top of the results
  const sessionId = session?.id
  const placedHere = useRef(false)
  useEffect(() => {
    if (sessionId && placedHere.current) sessionHeading.current?.focus()
  }, [sessionId])

  const place = () => {
    if (!online || ready.length === 0) return
    placedHere.current = true
    store.start(ready.map((group) => orderFrom(group, methodFor(group.type))))
  }

  /** The retry button disappears once pressed, so focus goes to its order's heading */
  const retryOrder = (groupType: string) => {
    if (!online) return
    store.retry(groupType)
    document.getElementById(orderHeadingId(groupType))?.focus()
  }

  const updatable = new Set(cart?.groups.filter((group) => group.ready).map((group) => group.type))

  return (
    <div className="space-y-6">
      <PageHeading title="Checkout" />
      {session ? (
        <SessionView
          session={session}
          online={online}
          headingRef={sessionHeading}
          onRetry={retryOrder}
          onSetMethod={(groupType, method) => store.setMethod(groupType, method)}
          updatable={updatable}
          onUpdateItems={(groupType) => {
            const group = groups.get(groupType)
            if (!online || !group?.ready) return
            store.updateItems(groupType, checkoutItems(group), group.subtotals)
            document.getElementById(orderHeadingId(groupType))?.focus()
          }}
          onDone={() => {
            store.clear()
            navigate('/cart')
          }}
        />
      ) : status.kind === 'loading' || status.kind === 'offline' ? (
        <div aria-busy="true" className="space-y-4">
          <p role="status" className="text-sm text-muted-foreground">
            {status.kind === 'offline' ? "You're offline. Your cart will load once you reconnect." : 'Loading your cart…'}
          </p>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : status.kind === 'error' ? (
        <StatePanel
          icon={CloudOff}
          title={failureMessage([status.error], 'your cart').title}
          tone="error"
          role="alert"
          action={<RetryButton retrying={retrying} onRetry={retry} />}
        >
          {failureMessage([status.error], 'your cart').body}
        </StatePanel>
      ) : ready.length === 0 ? (
        <StatePanel
          icon={ShoppingCart}
          title="Nothing ready to book"
          action={
            <Button asChild>
              <Link to="/cart">Go to your cart</Link>
            </Button>
          }
        >
          Choose what to book from your cart.
        </StatePanel>
      ) : (
        <ReviewView
          groups={ready}
          skipped={skipped}
          methodFor={methodFor}
          onMethodChange={(type, method) => setMethods((current) => ({ ...current, [type]: method }))}
          onPlace={place}
          online={online}
        />
      )}
    </div>
  )
}
