import { useEffect } from 'react'

const APP_NAME = 'medex'

/** Sets the tab title, which screen readers also announce on page changes */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
