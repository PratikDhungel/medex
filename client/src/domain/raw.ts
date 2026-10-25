// Shapes returned by the API, exactly as served. Money arrives as strings
// ("6200.00") and anything may be missing, so nothing here is trusted as-is.

export type RawAdjustmentType = 'percent' | 'amount'

export interface RawPricing {
  price: string | null
  discount: string | null
  discountType: RawAdjustmentType | null
  serviceCharge: string | null
  serviceChargeType: RawAdjustmentType | null
}

export interface RawWellnessTier extends RawPricing {
  id: string
  durationInMinutes: number
}

export interface RawService extends RawPricing {
  id: string
  title: string
  slug: string
  type: string
  userId: number
  categoryId: string | null
  subCategoryId: string | null
  status: boolean
  testAtHome: boolean
  homeTestCharge: string | null
  wellnessPricing: RawWellnessTier[]
  createdAt: string
}

export interface RawCategory {
  id: string
  title: string
  slug: string
  type: string
  position: number
  status: boolean
  parentId: string | null
  children?: RawCategory[]
}

export interface RawProvider {
  id: number
  name: string
  username: string
  status: string
  providerInformation?: {
    companyName: string
    slug: string
    types: string[]
    currency: string
    city: { id: string; name: string; slug: string } | null
    country: { id: number; name: string; alphaCode: string } | null
    rating: number | null
    reviewCount: number | null
  }
}
