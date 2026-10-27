// Shapes as the MedEx API sends them. Providers enter product data by hand,
// so the server only relies on what it needs and the client normalises the rest.

export type PaymentMethod = 'card' | 'pay_at_clinic'
export type OrderStatus = 'pending' | 'paid' | 'failed'

export interface WellnessOption {
  id: string
  durationInMinutes: number
  /** Final price per unit for this duration */
  amount_after_service_charge: number | null
}

export interface Product {
  id: string
  title: string
  type: string
  currency: string
  providerId: number
  providerName: string
  /** Final price per unit; null for wellness services, which are priced per duration */
  price: number | null
  priceUnknown?: boolean
  wellnessPricing?: WellnessOption[]
}

/** What a line's product becomes once the provider removes the service */
export type RemovedProduct = Record<string, never>

export interface CartLine {
  id: string
  productId: string
  quantity: number
  /** The chosen duration; only wellness lines have one, null until chosen */
  wellnessPricingId?: string | null
  product: Product | RemovedProduct
}

export interface CartGroup {
  type: string
  /** Sum of quantities, not number of lines */
  itemCount: number
  unpricedItems: number
  subtotals: Record<string, number>
  items: CartLine[]
}

export interface Cart {
  groups: CartGroup[]
  totalItems: number
}

export interface GuestCartItem {
  productId: string
  quantity: number
  wellnessPricingId?: string
}
