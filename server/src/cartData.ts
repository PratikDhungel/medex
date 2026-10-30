import { readFileSync } from 'node:fs'
import { flattenCart } from './cart/cart.js'
import type { CartLine, GuestCartItem, Product } from './cart/types.js'
import { dataFile } from './paths.js'

export interface CartData {
  catalog: Product[]
  /** The server cart's lines; groups and totals are recomputed from these */
  serverLines: CartLine[]
  guestCart: GuestCartItem[]
}

const DATA_FILE = dataFile('task2-cart.json')

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function loadCartData(file: URL = DATA_FILE): CartData {
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
  const fail = (message: string): never => {
    throw new Error(`${file.pathname}: ${message}`)
  }

  if (!isObject(raw)) fail('expected a JSON object')
  const { catalog, serverCart, guestCart } = raw as Record<string, unknown>

  if (!Array.isArray(catalog)) fail('"catalog" must be an array')
  if (!Array.isArray(guestCart)) fail('"guestCart" must be an array')
  if (!isObject(serverCart) || !Array.isArray(serverCart.groups)) fail('"serverCart.groups" must be an array')

  const groups = (serverCart as { groups: unknown[] }).groups
  groups.forEach((group, index) => {
    if (!isObject(group) || !Array.isArray(group.items)) fail(`"serverCart.groups[${index}].items" must be an array`)
  })

  // Line contents are not checked here: messy product data is what the client has to handle
  return {
    catalog: catalog as Product[],
    serverLines: flattenCart(serverCart as { groups: { items: CartLine[] }[] }),
    guestCart: guestCart as GuestCartItem[],
  }
}
