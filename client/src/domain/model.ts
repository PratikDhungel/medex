import type { Price } from './pricing'

// Clean domain records the app works with, built from the raw API shapes.

export interface Provider {
  id: number
  name: string
  slug: string
  active: boolean
  /** ISO 4217 code; null when the provider's currency is missing or malformed */
  currency: string | null
  types: string[]
  city: { slug: string; name: string } | null
  country: { code: string; name: string } | null
  /** null when unrated (no reviews) or out of range */
  rating: number | null
  reviewCount: number
}

export interface Category {
  id: string
  title: string
  slug: string
  type: string
  position: number
  parentId: string | null
  /** Own status, and the parent's for a subcategory */
  active: boolean
}

export interface WellnessTier {
  id: string
  durationMinutes: number
  price: Price
}

export type ServicePricing =
  | { kind: 'fixed'; price: Price }
  /** Wellness durations, sorted shortest first; never empty */
  | { kind: 'tiers'; tiers: WellnessTier[] }
  /** No usable price: shown as "Price on request" */
  | { kind: 'none' }

export interface Service {
  id: string
  title: string
  slug: string
  type: string
  providerId: number
  categoryId: string | null
  subCategoryId: string | null
  pricing: ServicePricing
  /** Cheapest final price across tiers; null with no price. Used for sorting. */
  minPrice: number | null
  homeTest: { available: boolean; fee: number | null }
  createdAt: string
}

export type HiddenReason =
  | 'service-inactive'
  | 'provider-missing'
  | 'provider-inactive'
  | 'category-missing'
  | 'category-inactive'

export interface DataIssue {
  entity: 'service' | 'provider' | 'category'
  id: string
  code: string
  detail?: string
}
