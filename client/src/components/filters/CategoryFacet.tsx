import type { CategoryFacetGroup } from '@/domain/filters'
import { FacetTreeNode } from './FacetTree'

interface CategoryFacetProps {
  groups: CategoryFacetGroup[]
  /** False when categories failed to load */
  available: boolean
  onChange: (categoryId: string, selected: boolean) => void
}

/**
 * Categories under their service type. The type heading is what tells the
 * two top-level "Ultrasound" categories apart.
 */
export function CategoryFacet({ groups, available, onChange }: CategoryFacetProps) {
  if (!available) {
    return <p className="text-sm text-muted-foreground">Categories couldn't be loaded.</p>
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.type} className="space-y-1">
          <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</p>
          <ul aria-label={group.label} className="space-y-0.5">
            {group.nodes.map((node) => (
              <FacetTreeNode
                key={node.option.value}
                option={node.option}
                childOptions={node.children}
                onChange={onChange}
                childNoun="subcategories"
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
