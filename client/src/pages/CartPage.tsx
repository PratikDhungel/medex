import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PageHeading } from './PageHeading'

export function CartPage() {
  useDocumentTitle('Your cart')

  return <PageHeading title="Your cart">Each group in your cart is booked and paid for separately.</PageHeading>
}
