import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { revealOnNarrowScreens } from '@/lib/scroll'

interface StickyReviewBarProps {
  /** The review's heading: the bar shows while the review is below the screen */
  headingId: string
  /** What's chosen, e.g. "10:00 AM Bangkok time · Wed, Nov 4" */
  summary: string
  action: string
}

/**
 * On phones and tablets the review sits below a long list of times. Once a
 * time is chosen, this bar keeps the choice and the way to the review in
 * view until the review itself scrolls into sight.
 */
export function StickyReviewBar({ headingId, summary, action }: StickyReviewBarProps) {
  const [reviewBelow, setReviewBelow] = useState(false)

  useEffect(() => {
    const review = document.getElementById(headingId)?.closest('section')
    if (!review) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Hidden once the review is properly on screen, or scrolled past
        setReviewBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0)
      },
      // A review peeking in at the very bottom doesn't count as seen
      { rootMargin: '0px 0px -25% 0px' },
    )
    observer.observe(review)
    return () => observer.disconnect()
  }, [headingId, summary])

  if (!reviewBelow) return null

  const jump = () => {
    const heading = document.getElementById(headingId)
    revealOnNarrowScreens(() => heading?.closest('section') ?? null)
    heading?.focus({ preventScroll: true })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
      {/* Left room for the dev panel's button, which sits in this corner */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 pl-12 sm:pl-36">
        <p className="min-w-0 text-sm">
          <span className="block text-xs text-muted-foreground">Your choice</span>
          <span className="block leading-snug font-semibold">{summary}</span>
        </p>
        <Button size="sm" onClick={jump}>
          {action}
        </Button>
      </div>
    </div>
  )
}
