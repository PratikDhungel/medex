import type { ReactNode } from 'react'

interface PageHeadingProps {
  title: string
  children?: ReactNode
}

/** A page's h1. Focusable from script so the layout can move focus here on navigation. */
export function PageHeading({ title, children }: PageHeadingProps) {
  return (
    <div className="space-y-1">
      <h1 tabIndex={-1} className="font-accent text-2xl font-semibold tracking-tight outline-none sm:text-3xl">
        {title}
      </h1>
      {children && <p className="text-muted-foreground">{children}</p>}
    </div>
  )
}
