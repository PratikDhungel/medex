import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RetryButtonProps {
  retrying: boolean
  onRetry: () => void
  variant?: 'outline'
  /** Visible label; defaults to "Try again" */
  children?: string
}

export function RetryButton({ retrying, onRetry, variant, children = 'Try again' }: RetryButtonProps) {
  return (
    <Button variant={variant} onClick={onRetry} disabled={retrying}>
      <RotateCw aria-hidden className={cn(retrying && 'animate-spin')} />
      {retrying ? 'Retrying…' : children}
    </Button>
  )
}
