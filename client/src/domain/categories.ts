import type { Category } from './model'
import type { RawCategory } from './raw'

/**
 * Flattens the category tree into a lookup by id. Ids are the only safe key:
 * slugs repeat across types (two top-level "ultrasound"s) and parents.
 * A subcategory is only active when its parent is too.
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
