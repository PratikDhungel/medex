import { useQuery } from '@tanstack/react-query'
import { CloudOff, Hospital, WifiOff } from 'lucide-react'
import { bookingProvidersQuery } from '@/api/booking'
import { failureMessage } from '@/api/failureMessage'
import { ProviderList, ProviderListSkeleton } from '@/components/booking/ProviderList'
import { RetryButton } from '@/components/common/RetryButton'
import { StatePanel } from '@/components/explorer/StatePanel'
import { useCustomerZone } from '@/hooks/useCustomerZone'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useElapsed } from '@/hooks/useElapsed'
import { loadStatusOf } from '@/hooks/loadStatus'
import { useNow } from '@/hooks/useNow'
import { PageHeading } from './PageHeading'

const SLOW_AFTER_MS = 3000

export function BookProvidersPage() {
  useDocumentTitle('Book an appointment')
  const query = useQuery(bookingProvidersQuery)
  const status = loadStatusOf(query)
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)
  const customerZone = useCustomerZone()
  const now = useNow()

  return (
    <div className="space-y-6">
      <PageHeading title="Book an appointment">
        Appointment times are always shown in the provider's own time, with yours alongside.
      </PageHeading>
      <p role="status" aria-live="polite" className="sr-only">
        {status.kind === 'loading' ? (slow ? 'Still loading. This is taking longer than usual.' : 'Loading providers…') : ''}
      </p>
      {status.kind === 'loading' && (
        <>
          {slow && <p className="text-sm text-muted-foreground">Still loading. This is taking longer than usual.</p>}
          <ProviderListSkeleton />
        </>
      )}
      {status.kind === 'offline' && (
        <StatePanel icon={WifiOff} title="You're offline" role="status">
          Providers will load as soon as you're back online.
        </StatePanel>
      )}
      {status.kind === 'error' && (
        <StatePanel
          icon={CloudOff}
          title={failureMessage([status.error], 'the list of providers').title}
          tone="error"
          role="alert"
          action={<RetryButton retrying={query.isFetching} onRetry={() => void query.refetch()} />}
        >
          {failureMessage([status.error], 'the list of providers').body}
        </StatePanel>
      )}
      {status.kind === 'ready' &&
        (query.data && query.data.length > 0 ? (
          <ProviderList providers={query.data} customerZone={customerZone} now={now} />
        ) : (
          <StatePanel icon={Hospital} title="No providers take online bookings yet">
            Please check back soon.
          </StatePanel>
        ))}
    </div>
  )
}
