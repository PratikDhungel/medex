import { indexCategories } from './categories'
import type {
  Category,
  DataIssue,
  HiddenReason,
  Provider,
  Service,
  ServicePricing,
  WellnessTier,
} from './model'
import { parseMoney } from './money'
import { computePrice, type Price } from './pricing'
import type { RawCategory, RawProvider, RawService } from './raw'

export interface Catalog {
  /** Visible services only */
  services: Service[]
  providers: Map<number, Provider>
  categories: Map<string, Category>
  /** How many services each rule hid; a service counts under its first reason */
  hidden: Record<HiddenReason, number>
  issues: DataIssue[]
}

export interface RawCatalog {
  categories: RawCategory[]
  providers: RawProvider[]
  services: RawService[]
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ')

export function normaliseProvider(raw: RawProvider, issues: DataIssue[]): Provider {
  const info = raw.providerInformation
  const id = String(raw.id)
  if (!info) issues.push({ entity: 'provider', id, code: 'missing-information' })

  const currency = info?.currency?.trim().toUpperCase() ?? null
  const validCurrency = currency !== null && CURRENCY_PATTERN.test(currency)
  if (info && !validCurrency) {
    issues.push({ entity: 'provider', id, code: 'invalid-currency', detail: String(info.currency) })
  }

  const reviewCount = info?.reviewCount ?? 0
  let rating = info?.rating ?? null
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
    issues.push({ entity: 'provider', id, code: 'invalid-rating', detail: String(rating) })
    rating = null
  }

  return {
    id: raw.id,
    name: cleanText(info?.companyName || raw.name),
    slug: info?.slug || raw.username,
    active: raw.status?.trim().toLowerCase() === 'active',
    currency: validCurrency ? currency : null,
    types: info?.types ?? [],
    city: info?.city ? { slug: info.city.slug, name: cleanText(info.city.name) } : null,
    country: info?.country ? { code: info.country.alphaCode, name: cleanText(info.country.name) } : null,
    // A rating backed by no reviews isn't a rating
    rating: reviewCount > 0 ? rating : null,
    reviewCount,
  }
}

function normalisePricing(raw: RawService, currency: string | null, issues: DataIssue[]): ServicePricing {
  const flag = (price: Price | null, tierId?: string) => {
    for (const code of price?.issues ?? []) {
      issues.push({ entity: 'service', id: raw.id, code, detail: tierId })
    }
  }

  if (currency === null) return { kind: 'none' }

  // Wellness services price by duration; `price` is null for them
  if (raw.wellnessPricing?.length) {
    const tiers: WellnessTier[] = []
    for (const tier of raw.wellnessPricing) {
      const price = computePrice(tier)
      flag(price, tier.id)
      if (price && tier.durationInMinutes > 0) {
        tiers.push({ id: tier.id, durationMinutes: tier.durationInMinutes, price })
      } else {
        issues.push({ entity: 'service', id: raw.id, code: 'invalid-wellness-tier', detail: tier.id })
      }
    }
    tiers.sort((a, b) => a.durationMinutes - b.durationMinutes)
    return tiers.length ? { kind: 'tiers', tiers } : { kind: 'none' }
  }

  const price = computePrice(raw)
  flag(price)
  if (!price) issues.push({ entity: 'service', id: raw.id, code: 'missing-price', detail: String(raw.price) })
  return price ? { kind: 'fixed', price } : { kind: 'none' }
}

function minPrice(pricing: ServicePricing): number | null {
  switch (pricing.kind) {
    case 'fixed':
      return pricing.price.final
    case 'tiers':
      return Math.min(...pricing.tiers.map((tier) => tier.price.final))
    case 'none':
      return null
  }
}

export function normaliseService(raw: RawService, provider: Provider | undefined, issues: DataIssue[]): Service {
  const title = cleanText(raw.title)
  if (title !== raw.title) issues.push({ entity: 'service', id: raw.id, code: 'untidy-title', detail: raw.title })

  const fee = parseMoney(raw.homeTestCharge)
  if (!raw.testAtHome && fee !== null && fee > 0) {
    issues.push({ entity: 'service', id: raw.id, code: 'home-fee-without-home-test' })
  }

  const pricing = normalisePricing(raw, provider?.currency ?? null, issues)

  return {
    id: raw.id,
    title,
    slug: raw.slug,
    type: raw.type,
    providerId: raw.userId,
    categoryId: raw.categoryId,
    subCategoryId: raw.subCategoryId,
    pricing,
    minPrice: minPrice(pricing),
    homeTest: { available: raw.testAtHome === true, fee: raw.testAtHome ? fee : null },
    createdAt: raw.createdAt,
  }
}

/**
 * Why a service must not be shown, or null when it is visible. A service is
 * visible when it is active, its provider is active, and its category and
 * subcategory (if any) are active. A category missing from the response is
 * treated as inactive: the source endpoint only lists active ones.
 */
export function hiddenReason(
  raw: RawService,
  provider: Provider | undefined,
  categories: Map<string, Category>,
): HiddenReason | null {
  if (raw.status !== true) return 'service-inactive'
  if (!provider) return 'provider-missing'
  if (!provider.active) return 'provider-inactive'

  for (const id of [raw.categoryId, raw.subCategoryId]) {
    if (id === null || id === undefined) continue
    const category = categories.get(id)
    if (!category) return 'category-missing'
    if (!category.active) return 'category-inactive'
  }
  return null
}

export function buildCatalog(raw: RawCatalog): Catalog {
  const issues: DataIssue[] = []
  const categories = indexCategories(raw.categories)

  const providers = new Map<number, Provider>()
  for (const rawProvider of raw.providers) {
    if (providers.has(rawProvider.id)) {
      issues.push({ entity: 'provider', id: String(rawProvider.id), code: 'duplicate-id' })
      continue
    }
    providers.set(rawProvider.id, normaliseProvider(rawProvider, issues))
  }

  const hidden: Record<HiddenReason, number> = {
    'service-inactive': 0,
    'provider-missing': 0,
    'provider-inactive': 0,
    'category-missing': 0,
    'category-inactive': 0,
  }
  const seen = new Set<string>()
  const services: Service[] = []

  for (const rawService of raw.services) {
    if (seen.has(rawService.id)) {
      issues.push({ entity: 'service', id: rawService.id, code: 'duplicate-id' })
      continue
    }
    seen.add(rawService.id)

    const provider = providers.get(rawService.userId)
    const reason = hiddenReason(rawService, provider, categories)
    if (reason) {
      hidden[reason] += 1
      continue
    }

    const subCategory = rawService.subCategoryId ? categories.get(rawService.subCategoryId) : undefined
    if (subCategory && subCategory.parentId !== rawService.categoryId) {
      issues.push({ entity: 'service', id: rawService.id, code: 'subcategory-parent-mismatch' })
    }

    services.push(normaliseService(rawService, provider, issues))
  }

  return { services, providers, categories, hidden, issues }
}
