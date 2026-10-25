import type { ReactNode } from 'react'

interface FilterSectionProps {
  title: string
  children: ReactNode
  /** Shown beside the title, e.g. a "Clear" button */
  action?: ReactNode
}

/** One titled group of filter controls. A fieldset so screen readers announce the group name. */
export function FilterSection({ title, children, action }: FilterSectionProps) {
  return (
    <fieldset className="min-w-0 space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <legend className="font-accent text-sm font-semibold">{title}</legend>
        {action}
      </div>
      {children}
    </fieldset>
  )
}
