import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Booking } from './CartView'

interface BookButtonProps {
  booking: Booking
  groupTypes: string[]
  children: ReactNode
  variant?: 'default' | 'outline'
  className?: string
}

/** Starts checkout for these groups; inactive while another checkout is unfinished */
export function BookButton({ booking, groupTypes, children, variant = 'default', className }: BookButtonProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <Button
        variant={variant}
        aria-disabled={booking.blocked}
        className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => !booking.blocked && booking.onBook(groupTypes)}
      >
        {children}
      </Button>
      {booking.blocked && <p className="text-xs text-muted-foreground">Finish your current checkout first.</p>}
    </div>
  )
}
