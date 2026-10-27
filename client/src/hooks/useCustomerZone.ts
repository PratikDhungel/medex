import { useSyncExternalStore } from 'react'
import type { TimeZone } from '@shared/time/zone'
import { deviceTimeZone } from '@/domain/booking/clock'
import { customerZoneOverride, subscribeCustomerZoneOverride } from '@/lib/customerZoneOverride'

const resolved = new Map<string, TimeZone>()

/** One zone object per override (or the device), so renders get the same value */
function zoneFor(override: string | null): TimeZone {
  const key = override ?? ''
  let zone = resolved.get(key)
  if (!zone) {
    // The override goes through the same name handling as the device's zone
    zone = override ? deviceTimeZone(Date.now(), override) : deviceTimeZone(Date.now())
    resolved.set(key, zone)
  }
  return zone
}

/** The customer's own time zone: the device's, unless the dev panel overrides it */
export function useCustomerZone(): TimeZone {
  const override = useSyncExternalStore(subscribeCustomerZoneOverride, customerZoneOverride, () => null)
  return zoneFor(override)
}
