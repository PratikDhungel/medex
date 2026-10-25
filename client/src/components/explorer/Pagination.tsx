import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { pageItems } from '@/domain/pagination'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  pageCount: number
  /** Real links, so a page can be opened in a new tab or shared */
  hrefFor: (page: number) => string
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageCount, hrefFor, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null

  const link = (target: number, children: ReactNode, label: string, className?: string) => {
    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks open a new tab as usual
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
      event.preventDefault()
      onPageChange(target)
    }
    return (
      <a
        href={hrefFor(target)}
        onClick={onClick}
        aria-label={label}
        aria-current={target === page ? 'page' : undefined}
        className={cn(
          'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full px-3 text-sm font-medium tabular-nums outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
          target === page && 'bg-primary text-primary-foreground hover:bg-primary/90',
          className,
        )}
      >
        {children}
      </a>
    )
  }

  const disabledEdge = (children: ReactNode) => (
    <span aria-hidden className="inline-flex h-9 items-center gap-1 px-3 text-sm text-muted-foreground opacity-50">
      {children}
    </span>
  )

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1 pt-2">
      {page > 1
        ? link(page - 1, <><ChevronLeft aria-hidden className="size-4" /><span className="max-sm:sr-only">Previous</span></>, 'Previous page')
        : disabledEdge(<><ChevronLeft className="size-4" /><span className="max-sm:sr-only">Previous</span></>)}

      <ul className="flex items-center gap-1">
        {pageItems(page, pageCount).map((item, index) => (
          <li key={item ?? `gap-${index}`}>
            {item === null ? (
              <span aria-hidden className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              link(item, item, `Page ${item}`)
            )}
          </li>
        ))}
      </ul>

      {page < pageCount
        ? link(page + 1, <><span className="max-sm:sr-only">Next</span><ChevronRight aria-hidden className="size-4" /></>, 'Next page')
        : disabledEdge(<><span className="max-sm:sr-only">Next</span><ChevronRight className="size-4" /></>)}
    </nav>
  )
}
