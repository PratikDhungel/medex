import { ShoppingCart } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
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

  useEffect(() => {
    // Only page changes: the explorer's filters change the query string, not the path
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus()
  }, [pathname])

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="rounded-sm font-accent text-xl font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            medex
          </Link>
          <nav aria-label="Main">
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
