import { parseMoney } from '../money'
import { compareServiceTypes } from '../serviceTypes'
import type { BlockReason, Cart, CartGroup, CartIssue, CartLine, DurationOption, LineStatus } from './model'
import type { RawCart, RawCartGroup, RawCartLine, RawCartProduct } from './raw'
import { lineTotal, totalsByCurrency, toCents } from './totals'

/** Group type for lines whose product is gone, as the API sends it */
export const UNKNOWN_GROUP = 'unknown'

const CURRENCY_PATTERN = /^[A-Z]{3}$/

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ')

/** A product that's still offered; the API sends `{}` once the provider removes it */
const isProduct = (product: unknown): product is RawCartProduct & { id: string } =>
  isObject(product) && typeof product.id === 'string'

function normaliseCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return CURRENCY_PATTERN.test(code) ? code : null
}

/** Usable durations, shortest first. Options without an id, a duration or a valid price are dropped. */
function durationsOf(product: RawCartProduct, lineId: string, issues: CartIssue[]): DurationOption[] {
  const options: DurationOption[] = []
  const raw = Array.isArray(product.wellnessPricing) ? product.wellnessPricing : []

  for (const option of raw) {
    const id = isObject(option) && typeof option.id === 'string' ? option.id : null
    const minutes = isObject(option) ? option.durationInMinutes : null
    const price = isObject(option) ? parseMoney(option.amount_after_service_charge) : null

    if (id === null || options.some((o) => o.id === id) || !Number.isInteger(minutes) || (minutes as number) <= 0 || price === null) {
      issues.push({ scope: 'line', id: lineId, code: 'invalid-duration-option', detail: JSON.stringify(option) })
      continue
    }
    options.push({ id, minutes: minutes as number, price })
  }
  return options.sort((a, b) => a.minutes - b.minutes || a.price - b.price)
}

function blocked(reason: BlockReason): LineStatus {
  return { kind: 'blocked', reason }
}

function priced(unitPrice: number, quantity: number): LineStatus {
  return { kind: 'priced', unitPrice, total: lineTotal(unitPrice, quantity) }
}

/**
 * One cart line, or null when it can't be acted on at all (no id). The price
 * comes from the line's own data, never from flags such as `priceUnknown`:
 * a wellness price exists only once a duration is chosen.
 */
export function normaliseLine(raw: RawCartLine, groupType: string, issues: CartIssue[]): CartLine | null {
  if (!isObject(raw) || typeof raw.id !== 'string') {
    issues.push({ scope: 'group', id: groupType, code: 'line-without-id', detail: JSON.stringify(raw) })
    return null
  }

  const { id } = raw
  const quantityValid = Number.isInteger(raw.quantity) && (raw.quantity as number) >= 1
  if (!quantityValid) issues.push({ scope: 'line', id, code: 'invalid-quantity', detail: String(raw.quantity) })

  const base = {
    id,
    productId: typeof raw.productId === 'string' ? raw.productId : '',
    quantity: typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) ? raw.quantity : 0,
  }

  const product: unknown = raw.product
  if (!isProduct(product)) {
    return {
      ...base,
      title: null,
      provider: null,
      currency: null,
      durations: [],
      selectedDurationId: null,
      status: { kind: 'unavailable' },
    }
  }

  if (product.type !== groupType) {
    issues.push({ scope: 'line', id, code: 'type-differs-from-group', detail: `${String(product.type)} in ${groupType}` })
  }

  const title = typeof product.title === 'string' ? cleanText(product.title) : ''
  if (!title) issues.push({ scope: 'line', id, code: 'missing-title' })

  const currency = normaliseCurrency(product.currency)
  if (currency === null) issues.push({ scope: 'line', id, code: 'invalid-currency', detail: String(product.currency) })

  const providerName = typeof product.providerName === 'string' ? cleanText(product.providerName) : ''
  const provider = providerName
    ? { id: typeof product.providerId === 'number' ? product.providerId : null, name: providerName }
    : null

  const isWellness = product.type === 'wellness'
  const durations = isWellness ? durationsOf(product, id, issues) : []
  let selectedDurationId = isWellness && typeof raw.wellnessPricingId === 'string' ? raw.wellnessPricingId : null
  if (selectedDurationId !== null && !durations.some((d) => d.id === selectedDurationId)) {
    issues.push({ scope: 'line', id, code: 'unknown-duration-selected', detail: selectedDurationId })
    selectedDurationId = null
  }
  if (isWellness && product.price !== null && product.price !== undefined) {
    issues.push({ scope: 'line', id, code: 'wellness-price-ignored', detail: String(product.price) })
  }

  let status: LineStatus
  if (!quantityValid) {
    status = blocked('invalid-quantity')
  } else if (currency === null) {
    status = blocked('price-missing')
  } else if (isWellness) {
    const chosen = durations.find((d) => d.id === selectedDurationId)
    status = chosen ? priced(chosen.price, base.quantity) : blocked(durations.length ? 'needs-duration' : 'no-durations')
  } else {
    const price = parseMoney(product.price)
    if (price === null) issues.push({ scope: 'line', id, code: 'missing-price', detail: String(product.price) })
    status = price === null ? blocked('price-missing') : priced(price, base.quantity)
  }

  return {
    ...base,
    title: title || 'Unnamed service',
    provider,
    currency,
    durations,
    selectedDurationId,
    status,
  }
}

export function buildGroup(type: string, lines: CartLine[]): CartGroup {
  const available = lines.filter((line) => line.status.kind !== 'unavailable')

  const subtotals = totalsByCurrency(
    available.flatMap((line) =>
      line.status.kind === 'priced' && line.currency ? [{ amount: line.status.total, currency: line.currency }] : [],
    ),
  )

  const providers: CartGroup['providers'] = []
  for (const { provider } of available) {
    if (provider && !providers.some((p) => p.id === provider.id && p.name === provider.name)) providers.push(provider)
  }

  const blockers = available.flatMap((line) =>
    line.status.kind === 'blocked' ? [{ lineId: line.id, reason: line.status.reason }] : [],
  )
  const bookable = available.length > 0

  return {
    type,
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotals,
    providers,
    bookable,
    blockers,
    excludedLineIds: lines.filter((line) => line.status.kind === 'unavailable').map((line) => line.id),
    ready: bookable && blockers.length === 0,
  }
}

/** Flags server subtotals that disagree with the lines. The UI always shows its own. */
function checkSubtotals(group: CartGroup, raw: unknown, issues: CartIssue[]) {
  if (!isObject(raw)) return
  const ours = new Map(group.subtotals.map(({ currency, amount }) => [currency, toCents(amount)]))
  const theirs = Object.entries(raw).filter(([, amount]) => typeof amount === 'number')
  const differs =
    theirs.length !== ours.size || theirs.some(([currency, amount]) => ours.get(currency) !== toCents(amount as number))
  if (differs) issues.push({ scope: 'group', id: group.type, code: 'subtotal-mismatch', detail: JSON.stringify(raw) })
}

/**
 * The cart as the UI shows it. The server's groups are kept, since each one
 * is checked out as a unit, but every count and total is recomputed from the
 * lines rather than trusted.
 */
export function normaliseCart(raw: RawCart): Cart {
  const issues: CartIssue[] = []
  const linesByType = new Map<string, CartLine[]>()
  const rawSubtotals = new Map<string, unknown>()
  const duplicated = new Set<string>()

  raw.groups.forEach((group: RawCartGroup, index) => {
    if (!isObject(group) || !Array.isArray(group.items)) {
      issues.push({ scope: 'group', id: String(index), code: 'malformed-group' })
      return
    }
    const type = typeof group.type === 'string' && group.type ? group.type : UNKNOWN_GROUP
    const lines = (group.items as RawCartLine[])
      .map((line) => normaliseLine(line, type, issues))
      .filter((line): line is CartLine => line !== null)

    // The API shouldn't send a type twice; if it does, it is still one order
    if (linesByType.has(type)) {
      duplicated.add(type)
      issues.push({ scope: 'group', id: type, code: 'duplicate-group' })
    }
    linesByType.set(type, [...(linesByType.get(type) ?? []), ...lines])
    rawSubtotals.set(type, group.subtotals)
  })

  const groups = [...linesByType]
    .filter(([, lines]) => lines.length > 0)
    .map(([type, lines]) => buildGroup(type, lines))
    .sort((a, b) => Number(b.bookable) - Number(a.bookable) || compareServiceTypes(a.type, b.type))

  // A merged duplicate has no single server subtotal to compare with
  for (const group of groups) {
    if (!duplicated.has(group.type)) checkSubtotals(group, rawSubtotals.get(group.type), issues)
  }

  return { groups, itemCount: groups.reduce((sum, group) => sum + group.itemCount, 0), issues }
}
