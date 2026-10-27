import type { RawGuestCartItem } from '@/domain/cart/raw'
import { ApiError, requestJson } from './client'

// Dev-only controls for the mock server (see server/README.md). Used by the
// dev panel, and to seed "this device" with the guest cart from the data file.

export const MOCK_ENDPOINTS = [
  'getCart',
  'updateLine',
  'removeLine',
  'mergeCart',
  'checkout',
  'getOrder',
  'bookingProviders',
  'bookingProvider',
  'availability',
  'slots',
  'createBooking',
  'getBooking',
  'updateBooking',
] as const
export type MockEndpoint = (typeof MOCK_ENDPOINTS)[number]

export interface MockRule {
  endpoint: MockEndpoint
  delayMs?: number
  /** Error status to answer with; 0 drops the connection */
  status?: number
  /** `after`: do the work, then fail anyway, like a lost response. `raced`: someone else takes the slot first (booking writes only). */
  when?: 'before' | 'after' | 'raced'
  match?: Record<string, string>
  times?: number
}

export interface MockConfig {
  rules: MockRule[]
  settlement: { outcome: 'paid' | 'failed'; afterMs: number }
  /** Specialists treated as fully booked on every day */
  fullyBookedSpecialists: string[]
}

const CONFIG_PATH = '/__mock/config'

export async function getMockConfig(): Promise<MockConfig> {
  return (await requestJson(CONFIG_PATH)) as MockConfig
}

export async function setMockConfig(config: MockConfig): Promise<MockConfig> {
  return (await requestJson(CONFIG_PATH, { method: 'PUT', body: config })) as MockConfig
}

/** Restores the seed cart and bookings, and forgets all orders */
export async function resetMockData(): Promise<void> {
  await requestJson('/__mock/reset', { method: 'POST' })
}

export async function getGuestCartFixture(): Promise<RawGuestCartItem[]> {
  const path = '/__mock/guest-cart'
  const body = await requestJson(path)
  if (!Array.isArray(body)) throw new ApiError('invalid', path, 'The server sent an unexpected guest cart')
  return body as RawGuestCartItem[]
}
