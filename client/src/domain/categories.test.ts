/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalog, type RawCatalog } from './catalog'
import {
  buildCategoryTree,
  categoryPath,
  indexCategories,
  matchesCategories,
  sanitiseCategoryIds,
} from './categories'
import type { Service } from './model'
import type { RawCategory } from './raw'

const node = (id: string, overrides: Partial<RawCategory> = {}): RawCategory => ({
  id,
  title: id,
  slug: id,
  type: 'lab_test',
  position: 1,
  status: true,
  parentId: null,
  ...overrides,
})

// Mirrors the real data's traps: two top-level "ultrasound"s of different
// types, and three "thyroid"s under different parents.
const raw: RawCategory[] = [
  node('us-lab', {
    title: 'Ultrasound',
    slug: 'ultrasound',
    position: 2,
    children: [node('thy-us-lab', { title: 'Thyroid', slug: 'thyroid', parentId: 'us-lab' })],
  }),
  node('blood', {
    title: 'Blood Tests',
    slug: 'blood-tests',
    position: 1,
    children: [
      node('thy-blood', { title: 'Thyroid', slug: 'thyroid', parentId: 'blood', position: 2 }),
      node('lipid', { title: 'Lipid', slug: 'lipid', parentId: 'blood', position: 1 }),
    ],
  }),
  node('us-pkg', {
    title: 'Ultrasound',
    slug: 'ultrasound',
    type: 'package',
    children: [node('thy-us-pkg', { title: 'Thyroid', slug: 'thyroid', type: 'package', parentId: 'us-pkg' })],
  }),
  node('seasonal', { title: 'Seasonal', type: 'package', status: false, position: 2 }),
]
const categories = indexCategories(raw)

const service = (categoryId: string | null, subCategoryId: string | null = null) =>
  ({ categoryId, subCategoryId }) as Service

describe('indexCategories', () => {
  it('keeps categories that share a slug apart', () => {
    expect(categories.get('us-pkg')).toMatchObject({ slug: 'ultrasound', type: 'package' })
    expect(categories.get('us-lab')).toMatchObject({ slug: 'ultrasound', type: 'lab_test' })
    expect(categories.get('thy-blood')).toMatchObject({ slug: 'thyroid', parentId: 'blood' })
  })

  it('makes a child inactive when its parent is', () => {
    const index = indexCategories([node('p', { status: false, children: [node('c', { parentId: 'p' })] })])
    expect(index.get('c')?.active).toBe(false)
  })
})

describe('buildCategoryTree', () => {
  const tree = buildCategoryTree(categories)

  it('groups top-level categories by type, in type order', () => {
    expect(tree.map((group) => group.label)).toEqual(['Packages', 'Lab tests'])
  })

  it('orders siblings by position and nests children under their own parent', () => {
    const labs = tree[1].nodes
    expect(labs.map((n) => n.category.id)).toEqual(['blood', 'us-lab'])
    expect(labs[0].children.map((c) => c.id)).toEqual(['lipid', 'thy-blood'])
    expect(labs[1].children.map((c) => c.id)).toEqual(['thy-us-lab'])
  })

  it('leaves out inactive categories', () => {
    expect(tree[0].nodes.map((n) => n.category.id)).toEqual(['us-pkg'])
  })
})

describe('categoryPath', () => {
  it('tells same-named categories apart', () => {
    expect(categoryPath('thy-blood', categories)).toEqual(['Lab tests', 'Blood Tests', 'Thyroid'])
    expect(categoryPath('thy-us-lab', categories)).toEqual(['Lab tests', 'Ultrasound', 'Thyroid'])
    expect(categoryPath('us-pkg', categories)).toEqual(['Packages', 'Ultrasound'])
    expect(categoryPath('nope', categories)).toEqual([])
  })
})

describe('sanitiseCategoryIds', () => {
  it('drops unknown, inactive and repeated ids, keeping order', () => {
    expect(sanitiseCategoryIds(['us-lab', 'nope', 'seasonal', 'blood', 'us-lab', 'thyroid'], categories)).toEqual([
      'us-lab',
      'blood',
    ])
  })
})

describe('matchesCategories', () => {
  it('matches everything with no selection', () => {
    expect(matchesCategories(service(null), new Set())).toBe(true)
  })

  it('includes every subcategory when a parent is selected', () => {
    const selected = new Set(['blood'])
    expect(matchesCategories(service('blood', 'thy-blood'), selected)).toBe(true)
    expect(matchesCategories(service('blood'), selected)).toBe(true)
    expect(matchesCategories(service('us-lab', 'thy-us-lab'), selected)).toBe(false)
  })

  it('matches only the selected subcategory, not others with the same slug', () => {
    const selected = new Set(['thy-blood'])
    expect(matchesCategories(service('blood', 'thy-blood'), selected)).toBe(true)
    expect(matchesCategories(service('blood', 'lipid'), selected)).toBe(false)
    expect(matchesCategories(service('us-lab', 'thy-us-lab'), selected)).toBe(false)
    expect(matchesCategories(service('us-pkg', 'thy-us-pkg'), selected)).toBe(false)
  })

  it('never matches an uncategorised service once something is selected', () => {
    expect(matchesCategories(service(null), new Set(['blood']))).toBe(false)
  })
})

describe('categories on the real data', () => {
  const catalog = buildCatalog(
    JSON.parse(
      readFileSync(new URL('../../../server/data/task1-service-explorer.json', import.meta.url), 'utf8'),
    ) as RawCatalog,
  )
  const find = (slug: string, type: string, parentSlug: string | null) =>
    [...catalog.categories.values()].find(
      (c) =>
        c.slug === slug &&
        c.type === type &&
        (c.parentId ? catalog.categories.get(c.parentId)?.slug : null) === parentSlug,
    )!
  const count = (id: string) => catalog.services.filter((s) => matchesCategories(s, new Set([id]))).length

  it('keeps the two top-level ultrasounds separate', () => {
    const tree = buildCategoryTree(catalog.categories)
    const ultrasounds = tree.flatMap((g) => g.nodes.filter((n) => n.category.slug === 'ultrasound').map(() => g.label))
    expect(ultrasounds).toEqual(['Packages', 'Lab tests'])
  })

  it('counts each thyroid on its own, adding up to their total', () => {
    const thyroids = [
      find('thyroid', 'package', 'ultrasound'),
      find('thyroid', 'lab_test', 'ultrasound'),
      find('thyroid', 'lab_test', 'blood-tests'),
    ]
    const counts = thyroids.map((c) => count(c.id))
    const bySlug = catalog.services.filter((s) => thyroids.some((t) => t.id === s.subCategoryId)).length
    expect(counts.every((n) => n > 0)).toBe(true)
    expect(counts.reduce((a, b) => a + b)).toBe(bySlug)
  })
})
