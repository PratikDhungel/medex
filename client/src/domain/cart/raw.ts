// Shapes from the cart API, as served (GET /v2/cart). Providers enter product
// data by hand, so every product field may be missing or the wrong type, and
// `product` is `{}` once the provider has removed the service.

export interface RawWellnessOption {
  id?: unknown
  durationInMinutes?: unknown
  /** Final price per unit for this duration */
  amount_after_service_charge?: unknown
}

export interface RawCartProduct {
  id?: unknown
  title?: unknown
  type?: unknown
  currency?: unknown
  providerId?: unknown
  providerName?: unknown
  /** Final price per unit; null for wellness services */
  price?: unknown
  priceUnknown?: unknown
  wellnessPricing?: unknown
}

export interface RawCartLine {
  id?: unknown
  productId?: unknown
  quantity?: unknown
  wellnessPricingId?: unknown
  product?: RawCartProduct | null
}

export interface RawCartGroup {
  type?: unknown
  itemCount?: unknown
  unpricedItems?: unknown
  subtotals?: unknown
  items?: unknown
}

export interface RawCart {
  groups: RawCartGroup[]
  totalItems?: unknown
}
