// Clean cart records the UI works with, built from the raw API shapes.

/** An amount in one currency. Amounts in different currencies are never added together. */
export interface Money {
  amount: number
  currency: string
}

export interface DurationOption {
  id: string
  minutes: number
  /** Final price per unit for this duration */
  price: number
}

/** Why a line has no price yet, and so stops its group from being checked out */
export type BlockReason =
  /** Wellness service waiting for the customer to pick a duration */
  | 'needs-duration'
  /** Wellness service with no duration that can be booked (data error) */
  | 'no-durations'
  /** Missing or malformed price or currency (data error) */
  | 'price-missing'
  /** Quantity that isn't a whole number of at least 1 (data error) */
  | 'invalid-quantity'

export type LineStatus =
  | { kind: 'priced'; unitPrice: number; total: number }
  /** The price is unknown. It is never counted as zero. */
  | { kind: 'blocked'; reason: BlockReason }
  /** The provider removed the service. Left out of every order; can only be removed. */
  | { kind: 'unavailable' }

export interface CartLine {
  id: string
  productId: string
  quantity: number
  /** null once the service was removed */
  title: string | null
  provider: { id: number | null; name: string } | null
  /** ISO 4217 code; null when removed, missing or malformed */
  currency: string | null
  /** Wellness durations, shortest first; empty for other services */
  durations: DurationOption[]
  selectedDurationId: string | null
  status: LineStatus
}

export interface CartGroup {
  type: string
  lines: CartLine[]
  /** Sum of quantities */
  itemCount: number
  /** One per currency, for priced lines only, sorted by currency code */
  subtotals: Money[]
  /** Distinct providers of the lines that can still be booked */
  providers: { id: number | null; name: string }[]
  /** False when only removed services are left, so there's nothing to order */
  bookable: boolean
  /** Lines without a price; while any remain the group can't be checked out */
  blockers: { lineId: string; reason: BlockReason }[]
  /** Removed services, which this group's order leaves out */
  excludedLineIds: string[]
  /** Bookable and nothing blocking: can be checked out now */
  ready: boolean
}

export interface CartIssue {
  scope: 'line' | 'group'
  id: string
  code: string
  detail?: string
}

export interface Cart {
  /** Bookable groups first, in service-type order; groups of removed services last */
  groups: CartGroup[]
  itemCount: number
  issues: CartIssue[]
}
