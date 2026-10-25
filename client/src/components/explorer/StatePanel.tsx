import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatePanelProps {
  icon: LucideIcon
  title: string
  children?: ReactNode
  /** Buttons or links offering a way out */
  action?: ReactNode
  tone?: 'neutral' | 'error'
  role?: 'alert' | 'status'
}

/** Full-width message used for the error, offline and empty states */
export function StatePanel({ icon: Icon, title, children, action, tone = 'neutral', role }: StatePanelProps) {
  return (
    <div
      role={role}
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center',
        tone === 'error' && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <Icon aria-hidden className={cn('size-8', tone === 'error' ? 'text-destructive' : 'text-muted-foreground')} />
      <h2 className="font-accent text-lg font-semibold">{title}</h2>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
