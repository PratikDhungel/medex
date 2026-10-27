import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { StatePanel } from '@/components/explorer/StatePanel'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PageHeading } from './PageHeading'

export function NotFoundPage() {
  useDocumentTitle('Page not found')

  return (
    <>
      <PageHeading title="Page not found" />
      <StatePanel
        icon={SearchX}
        title="We couldn't find that page"
        action={
          <Button asChild>
            <Link to="/">Find a health service</Link>
          </Button>
        }
      >
        The link may be old or mistyped.
      </StatePanel>
    </>
  )
}
