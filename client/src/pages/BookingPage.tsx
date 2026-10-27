import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { bookingProviderQuery } from '@/api/booking'
import { BookingView } from '@/components/booking/BookingView'
import { countryName } from '@/components/booking/copy'
import { selectedSpecialist } from '@/domain/booking/selection'
import { useBookingSelection } from '@/hooks/useBookingSelection'
import { useCustomerZone } from '@/hooks/useCustomerZone'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useElapsed } from '@/hooks/useElapsed'
import { loadStatusOf } from '@/hooks/loadStatus'
import { useNow } from '@/hooks/useNow'
import { NotFoundPage } from './NotFoundPage'
import { PageHeading } from './PageHeading'

const SLOW_AFTER_MS = 3000

export function BookingPage() {
  const providerId = Number(useParams().providerId)
  return Number.isInteger(providerId) ? <ProviderBookingPage providerId={providerId} /> : <NotFoundPage />
}

function ProviderBookingPage({ providerId }: { providerId: number }) {
  const query = useQuery(bookingProviderQuery(providerId))
  const status = loadStatusOf(query)
  const slow = useElapsed(status.kind === 'loading', SLOW_AFTER_MS)
  const customerZone = useCustomerZone()
  const now = useNow()
  const [selection, choose] = useBookingSelection()

  const provider = query.data
  const { specialist, stale } = selectedSpecialist(provider?.specialists ?? [], selection.specialistId)
  useDocumentTitle(provider ? `Book at ${provider.name}` : 'Book an appointment')

  return (
    <div className="space-y-6">
      <PageHeading title={provider?.name ?? 'Book an appointment'}>{countryName(provider?.country ?? null)}</PageHeading>
      <BookingView
        status={status}
        provider={provider}
        customerZone={customerZone}
        now={now}
        slow={slow}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        selection={selection}
        specialist={specialist}
        staleSpecialist={stale}
        onChoose={choose}
      />
    </div>
  )
}
