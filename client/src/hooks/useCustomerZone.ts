import { useState } from 'react'
import type { TimeZone } from '@shared/time/zone'
import { deviceTimeZone } from '@/domain/booking/clock'

/** The customer's own time zone, read from the device once per page */
export function useCustomerZone(): TimeZone {
  const [zone] = useState(() => deviceTimeZone(Date.now()))
  return zone
}
