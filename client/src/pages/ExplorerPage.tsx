import { ServiceExplorer } from '@/components/explorer/ServiceExplorer'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PageHeading } from './PageHeading'

export function ExplorerPage() {
  useDocumentTitle('Find a health service')

  return (
    <>
      <PageHeading title="Find a health service">Compare services and prices from providers near you.</PageHeading>
      <ServiceExplorer />
    </>
  )
}
