import { browserStorage } from './browserStorage'

// Dev panel: pretend the customer's device is in another time zone, so the
// two-clock design can be checked from anywhere (e.g. a customer in
// Kathmandu booking in Bangkok). Kept per browser; empty means the device's own.

const STORAGE_KEY = 'medex.dev.customerZone'
const CHANGE_EVENT = 'medex:customer-zone'

/** Zones worth trying: the three markets, plus ones that cross dates or have daylight saving */
export const ZONE_CHOICES = [
  'Asia/Kathmandu',
  'Asia/Bangkok',
  'Asia/Kolkata',
  'Europe/London',
  'America/New_York',
  'Pacific/Auckland',
  'Pacific/Honolulu',
] as const

export function customerZoneOverride(): string | null {
  return browserStorage().getItem(STORAGE_KEY) || null
}

export function setCustomerZoneOverride(zone: string | null) {
  const storage = browserStorage()
  if (zone) storage.setItem(STORAGE_KEY, zone)
  else storage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeCustomerZoneOverride(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  // Another tab changed it
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
