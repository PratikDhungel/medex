import { useMemo, useSyncExternalStore } from 'react'
import type { FilterState } from '@/domain/filters'
import { parseFilters, serialiseFilters } from '@/domain/urlState'

/** pushState and replaceState fire no event of their own */
const URL_CHANGE = 'medex:urlchange'

export type HistoryMode = 'push' | 'replace'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(URL_CHANGE, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(URL_CHANGE, onChange)
  }
}

const getSearch = () => window.location.search

/**
 * The filter state, read from and written to the URL. "push" adds a history
 * entry so Back undoes the change; "replace" doesn't, for changes such as
 * typing that would otherwise flood the history.
 */
export function useUrlFilters(): [FilterState, (next: FilterState, mode: HistoryMode) => void] {
  const search = useSyncExternalStore(subscribe, getSearch)
  const filters = useMemo(() => parseFilters(new URLSearchParams(search)), [search])

  const setFilters = (next: FilterState, mode: HistoryMode) => {
    const params = serialiseFilters(next, new URLSearchParams(window.location.search)).toString()
    const url = `${window.location.pathname}${params ? `?${params}` : ''}${window.location.hash}`
    if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return
    try {
      window.history[mode === 'push' ? 'pushState' : 'replaceState'](window.history.state, '', url)
    } catch {
      // Safari throttles history updates; the next change will catch up
      return
    }
    window.dispatchEvent(new Event(URL_CHANGE))
  }

  return [filters, setFilters]
}
