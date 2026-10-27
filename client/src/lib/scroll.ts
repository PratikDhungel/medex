/** Below Tailwind's `lg`, where the booking page is one column and the next step sits below the fold */
const ONE_COLUMN = '(max-width: 1023.98px)'

/**
 * Brings the next step into view on a one-column layout: smoothly, unless
 * the customer prefers reduced motion. Waits a frame so it lands after React
 * has rendered the change that prompted it.
 */
export function revealOnNarrowScreens(element: () => HTMLElement | null) {
  if (!window.matchMedia(ONE_COLUMN).matches) return
  requestAnimationFrame(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element()?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  })
}
