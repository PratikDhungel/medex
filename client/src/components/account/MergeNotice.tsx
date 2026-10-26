import { CircleCheck, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { describeMergeChanges } from '@/components/cart/mergeCopy'
import { Button } from '@/components/ui/button'
import type { RawMergeChange } from '@/domain/cart/raw'

interface MergeNoticeProps {
  changes: RawMergeChange[]
  onDismiss: () => void
}

/**
 * What logging in did to the cart. Takes focus when it appears, so the
 * customer hears what changed before anything else.
 */
export function MergeNotice({ changes, onDismiss }: MergeNoticeProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const sentences = describeMergeChanges(changes)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <section
      aria-labelledby="merge-notice"
      className="space-y-2 rounded-xl border border-emerald-600/30 bg-emerald-600/5 px-4 py-3 sm:px-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="merge-notice"
          ref={heading}
          tabIndex={-1}
          data-autofocus
          className="flex items-center gap-2 rounded-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          We've brought over the items from before you logged in
        </h2>
        <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss}>
          <X aria-hidden />
        </Button>
      </div>
      {sentences.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-10 text-sm">
          {sentences.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
