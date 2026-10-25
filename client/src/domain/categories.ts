import type { Category, Service } from './model'
import type { RawCategory } from './raw'
import { compareServiceTypes, serviceTypeLabel } from './serviceTypes'

/**
 * Flattens the category tree into a lookup by id. Ids are the only safe key:
 * slugs repeat across types (two top-level "ultrasound"s) and parents (three
 * "thyroid"s). A subcategory is only active when its parent is too.
 */
export function indexCategories(raw: RawCategory[]): Map<string, Category> {
  const byId = new Map<string, Category>()

  const visit = (node: RawCategory, parent: Category | null) => {
    if (byId.has(node.id)) return

    const category: Category = {
      id: node.id,
      title: node.title.trim(),
      slug: node.slug,
      type: node.type,
      position: node.position,
      parentId: parent?.id ?? null,
      active: node.status === true && (parent?.active ?? true),
    }
    byId.set(category.id, category)
    for (const child of node.children ?? []) visit(child, category)
  }

  for (const node of raw) visit(node, null)
  return byId
}

export interface CategoryNode {
  category: Category
  children: Category[]
}

/** Top-level categories grouped under their service type */
export interface CategoryTypeGroup {
  type: string
  label: string
  nodes: CategoryNode[]
}

const byPosition = (a: Category, b: Category) => a.position - b.position || a.title.localeCompare(b.title)

/**
 * The filter tree: type → category → subcategory, active categories only,
 * siblings by position. Grouping by type is what tells the two top-level
 * "Ultrasound" entries apart.
 */
export function buildCategoryTree(categories: Map<string, Category>): CategoryTypeGroup[] {
  const active = [...categories.values()].filter((category) => category.active)
  const childrenOf = new Map<string, Category[]>()
  for (const category of active) {
    if (category.parentId === null) continue
    const siblings = childrenOf.get(category.parentId) ?? []
    siblings.push(category)
    childrenOf.set(category.parentId, siblings)
  }

  const groups = new Map<string, CategoryNode[]>()
  for (const category of active.filter((c) => c.parentId === null).sort(byPosition)) {
    const nodes = groups.get(category.type) ?? []
    nodes.push({ category, children: (childrenOf.get(category.id) ?? []).sort(byPosition) })
    groups.set(category.type, nodes)
  }

  return [...groups]
    .sort(([a], [b]) => compareServiceTypes(a, b))
    .map(([type, nodes]) => ({ type, label: serviceTypeLabel(type), nodes }))
}

/**
 * Full path for a category, e.g. ["Lab Tests", "Blood Tests", "Thyroid"].
 * Unambiguous wherever a category appears without the tree around it,
 * such as an active-filter chip.
 */
export function categoryPath(id: string, categories: Map<string, Category>): string[] {
  const category = categories.get(id)
  if (!category) return []
  const parent = category.parentId ? categories.get(category.parentId) : undefined
  return [serviceTypeLabel(category.type), ...(parent ? [parent.title] : []), category.title]
}

/**
 * Keeps the ids from the URL that name an active category, deduplicated and
 * in their original order. Unknown, inactive or malformed ids are dropped.
 */
export function sanitiseCategoryIds(ids: readonly string[], categories: Map<string, Category>): string[] {
  return [...new Set(ids)].filter((id) => categories.get(id)?.active === true)
}

/**
 * Whether a service falls under any selected category. Selecting a parent
 * includes all of its subcategories; selecting a subcategory matches only it.
 * An empty selection matches everything.
 */
export function matchesCategories(service: Service, selected: ReadonlySet<string>): boolean {
  if (selected.size === 0) return true
  return (
    (service.categoryId !== null && selected.has(service.categoryId)) ||
    (service.subCategoryId !== null && selected.has(service.subCategoryId))
  )
}
