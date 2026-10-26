import { ShoppingCart } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { LogInButton } from '@/components/account/LogInButton'
import { Button } from '@/components/ui/button'
import { useAccount, useAccountStore } from '@/hooks/useAccount'
import { useCartItemCount } from '@/hooks/useCart'
import { cn } from '@/lib/utils'

/**
 * Header and page frame shared by every route. After a page change, focus
 * moves to the new page's heading so keyboard and screen-reader users start
 * from the top of the new content instead of the link they just used.
 */
export function AppLayout() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)
  const { account, guestCart } = useAccount()
  const accountStore = useAccountStore()
  const customerCount = useCartItemCount(account === 'customer')
  const cartCount =
    account === 'customer' ? customerCount : guestCart?.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    // Only page changes: the explorer's filters change the query string, not the path
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    // A page can point focus somewhere more useful than its heading (e.g. what logging in changed)
    const target = mainRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? mainRef.current?.querySelector<HTMLElement>('h1')
    target?.focus()
  }, [pathname])

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="rounded-sm font-accent text-xl font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            medex
          </Link>
          <nav aria-label="Main" className="flex items-center gap-2">
            {account === 'guest' ? (
              <LogInButton size="sm" variant="ghost" />
            ) : (
              <Button size="sm" variant="ghost" onClick={() => accountStore.logOut()}>
                Log out
              </Button>
            )}
            <NavLink
              to="/cart"
              className={({ isActive }) =>
                cn(
                  'inline-flex h-9 items-center gap-2 rounded-full px-4 font-accent text-sm font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  isActive && 'bg-accent',
                )
              }
            >
              <ShoppingCart aria-hidden className="size-4" />
              Cart
              {cartCount !== undefined && cartCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground tabular-nums">
                  {cartCount}
                  <span className="sr-only"> {cartCount === 1 ? 'item' : 'items'}</span>
                </span>
              )}
            </NavLink>
          </nav>
        </div>
      </header>

      <main ref={mainRef} className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
