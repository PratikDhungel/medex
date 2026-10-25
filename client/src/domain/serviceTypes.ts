// Known service types in display order. Unknown types from the API still
// work: they sort last and get a label derived from the raw value.
const SERVICE_TYPES = [
  { type: 'package', label: 'Packages' },
  { type: 'lab_test', label: 'Lab Tests' },
  { type: 'service', label: 'Services' },
  { type: 'wellness', label: 'Wellness' },
  { type: 'insurance', label: 'Insurance' },
]

const ORDER = new Map(SERVICE_TYPES.map(({ type }, index) => [type, index]))
const LABELS = new Map(SERVICE_TYPES.map(({ type, label }) => [type, label]))

export function serviceTypeLabel(type: string): string {
  const label = LABELS.get(type)
  if (label) return label
  const words = type.replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function compareServiceTypes(a: string, b: string): number {
  const rank = (type: string) => ORDER.get(type) ?? ORDER.size
  return rank(a) - rank(b) || a.localeCompare(b)
}
