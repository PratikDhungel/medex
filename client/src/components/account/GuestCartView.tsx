import { CloudOff, ShoppingCart } from 'lucide-react'
import { Link } from 'react-router'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { plural } from '@/components/cart/copy'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { RawCartProduct, RawGuestCartItem } from '@/domain/cart/raw'
import { serviceTypeLabel } from '@/domain/serviceTypes'
import { LogInButton } from './LogInButton'

export interface GuestCartViewProps {
  /** null while the device's cart is being loaded or couldn't be */
  items: RawGuestCartItem[] | null
  /** Product details by id; undefined while loading or if they couldn't be loaded */
  products: Map<string, RawCartProduct> | undefined
  failed: boolean
  retrying: boolean
  onRetry: () => void
}

function describe(item: RawGuestCartItem, product: RawCartProduct | undefined) {
  if (!product) return { title: 'An item that is no longer offered', details: '' }
  const options = Array.isArray(product.wellnessPricing) ? (product.wellnessPricing as { id?: unknown; durationInMinutes?: unknown }[]) : []
  const duration = options.find((option) => option.id === item.wellnessPricingId)?.durationInMinutes
  const details = [
    typeof product.type === 'string' ? serviceTypeLabel(product.type) : null,
    typeof product.providerName === 'string' ? product.providerName : null,
    typeof duration === 'number' ? `${duration} min` : null,
  ].filter(Boolean)
  return { title: typeof product.title === 'string' ? product.title : 'Unnamed service', details: details.join(' · ') }
}

/** A guest's cart: what's saved on this device, until they log in to book it */
export function GuestCartView({ items, products, failed, retrying, onRetry }: GuestCartViewProps) {
  if (failed) {
    return (
      <StatePanel icon={CloudOff} title="We couldn't load your saved items" tone="error" role="alert" action={<RetryButton retrying={retrying} onRetry={onRetry} />}>
        They're still saved on this device. You can also log in to see your account's cart.
      </StatePanel>
    )
  }
  if (items === null || (items.length > 0 && !products)) {
    return (
      <div aria-busy="true" className="space-y-3">
        <p role="status" className="text-sm text-muted-foreground">
          Loading your saved items…
        </p>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <StatePanel
        icon={ShoppingCart}
        title="Your cart is empty"
        action={
          <>
            <Button asChild variant="outline">
              <Link to="/">Find a health service</Link>
            </Button>
            <LogInButton>Log in to see your cart</LogInButton>
          </>
        }
      >
        Services you add will be saved on this device until you log in.
      </StatePanel>
    )
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <header className="space-y-1 px-4 pt-4 pb-2 sm:px-6 sm:pt-5">
          <h2 className="font-accent text-lg font-semibold">Saved on this device</h2>
          <p className="text-sm text-muted-foreground">{plural(count, 'item')}. Prices and booking appear once you log in.</p>
        </header>
        <ul className="px-4 sm:px-6">
          {items.map((item, index) => {
            const { title, details } = describe(item, products?.get(item.productId))
            return (
              <li key={`${item.productId}-${index}`} className="flex items-start justify-between gap-4 border-t py-3 first:border-t-0">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium break-words">{title}</p>
                  {details && <p className="text-sm text-muted-foreground">{details}</p>}
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">Quantity: {item.quantity}</p>
              </li>
            )
          })}
        </ul>
      </Card>
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          Log in to book. These items will be added to your account's cart, and we'll tell you exactly what changed.
        </p>
        <LogInButton>Log in to book</LogInButton>
      </div>
    </div>
  )
}
