import { readFileSync } from 'node:fs'

// Raw records are passed through untouched; the client normalises them and
// handles the data's quirks (string money, null wellness prices, hidden rows).
export type Category = Record<string, unknown> & { id: string; children?: Category[] }
export type Provider = Record<string, unknown> & { id: number }
export type Service = Record<string, unknown> & { id: string }

export interface ServiceExplorerData {
  categories: Category[]
  providers: Provider[]
  services: Service[]
}

// Resolves from src/ (tsx) and dist/ (compiled) alike
const DATA_FILE = new URL('../data/task1-service-explorer.json', import.meta.url)

export function loadServiceExplorerData(file: URL = DATA_FILE): ServiceExplorerData {
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))

  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`${file.pathname}: expected a JSON object`)
  }

  const { categories, providers, services } = raw as Record<string, unknown>
  for (const [key, value] of Object.entries({ categories, providers, services })) {
    if (!Array.isArray(value)) {
      throw new Error(`${file.pathname}: "${key}" must be an array`)
    }
  }

  return { categories, providers, services } as ServiceExplorerData
}
