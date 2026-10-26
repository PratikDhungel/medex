// Ids and URLs shared between the cart and checkout pages.

export const orderHeadingId = (groupType: string) => `order-${groupType}`

/** `?groups=lab_test,package`: the groups the customer chose to book, so a reload keeps the choice */
export function checkoutHref(groupTypes: string[]): string {
  return `/checkout?${new URLSearchParams({ groups: groupTypes.join(',') })}`
}
