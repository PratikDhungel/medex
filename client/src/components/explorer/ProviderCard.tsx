import { ChevronDown, House, MapPin, Star } from 'lucide-react'
import { useId } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { categoryPath } from '@/domain/categories'
import type { ProviderGroup } from '@/domain/grouping'
import type { Category, Provider, Service } from '@/domain/model'
import { formatMoney } from '@/domain/money'
import { cn } from '@/lib/utils'
import { PriceTag } from './PriceTag'

/** Services shown on a collapsed card */
export const COLLAPSED_SERVICE_COUNT = 3

const numberFormat = new Intl.NumberFormat('en')

function Rating({ provider }: { provider: Provider }) {
  if (provider.rating === null) {
    return <span className="text-muted-foreground">No reviews yet</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Star aria-hidden className="size-3.5 fill-current text-amber-500" />
      <span className="font-medium text-foreground">{provider.rating.toFixed(1)}</span>
      <span className="text-muted-foreground">
        ({numberFormat.format(provider.reviewCount)}
        <span className="sr-only"> reviews</span>)
      </span>
    </span>
  )
}

interface ServiceRowProps {
  service: Service
  currency: string | null
  categories: Map<string, Category>
}

function ServiceRow({ service, currency, categories }: ServiceRowProps) {
  // Path without the type: "Blood Tests › Thyroid" tells same-named subcategories apart
  const category = categoryPath(service.subCategoryId ?? service.categoryId ?? '', categories).slice(1).join(' › ')
  const { homeTest } = service

  return (
    <li className="flex items-start justify-between gap-4 border-t py-3 first:border-t-0">
      <div className="min-w-0 space-y-1">
        <p className="font-medium break-words">{service.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {category && <span>{category}</span>}
          {homeTest.available && (
            <Badge variant="secondary" className="font-normal">
              <House aria-hidden />
              Home test
              {homeTest.fee !== null && homeTest.fee > 0 && currency && (
                <span className="tabular-nums">+{formatMoney(homeTest.fee, currency)} visit</span>
              )}
            </Badge>
          )}
        </div>
      </div>
      <PriceTag pricing={service.pricing} currency={currency} />
    </li>
  )
}

interface ProviderCardProps {
  group: ProviderGroup
  categories: Map<string, Category>
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

export function ProviderCard({ group, categories, expanded, onExpandedChange }: ProviderCardProps) {
  const { provider, services } = group
  const headingId = useId()
  const listId = useId()

  const total = services.length
  const shown = expanded ? services : services.slice(0, COLLAPSED_SERVICE_COUNT)
  const location = [provider.city?.name, provider.country?.name].filter(Boolean).join(', ')

  return (
    <Card aria-labelledby={headingId} className="gap-0 py-0" role="article">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-2 sm:px-6 sm:pt-5">
        <div className="min-w-0 space-y-1">
          <h3 id={headingId} className="font-accent text-lg leading-snug font-semibold">
            {provider.name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {location && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin aria-hidden className="size-3.5" />
                {location}
              </span>
            )}
            <Rating provider={provider} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? 'service' : 'services'}
        </p>
      </header>

      <ul id={listId} className="px-4 sm:px-6">
        {shown.map((service) => (
          <ServiceRow key={service.id} service={service} currency={provider.currency} categories={categories} />
        ))}
      </ul>

      {total > COLLAPSED_SERVICE_COUNT ? (
        <div className="border-t px-2 py-2 sm:px-4">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? 'Show fewer' : `View all ${total} services`}
            <ChevronDown aria-hidden className={cn('transition-transform', expanded && 'rotate-180')} />
          </Button>
        </div>
      ) : (
        <div className="pb-2" />
      )}
    </Card>
  )
}

/** Placeholder shaped like a collapsed card, so nothing shifts when data arrives */
export function ProviderCardSkeleton() {
  return (
    <Card aria-hidden className="gap-0 py-0">
      <div className="space-y-2 px-4 pt-4 pb-2 sm:px-6 sm:pt-5">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="px-4 sm:px-6">
        {Array.from({ length: COLLAPSED_SERVICE_COUNT }, (_, index) => (
          <div key={index} className="flex justify-between gap-4 border-t py-3 first:border-t-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
      <div className="border-t px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-36" />
      </div>
    </Card>
  )
}
