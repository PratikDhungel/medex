import { ApiError } from './client'

export interface FailureMessage {
  title: string
  body: string
}

/** A plain-language message for why loading failed, most actionable cause first */
export function failureMessage(errors: readonly Error[]): FailureMessage {
  const kinds = new Set(errors.map((error) => (error instanceof ApiError ? error.kind : 'network')))

  if (kinds.has('offline')) {
    return { title: "You're offline", body: 'Reconnect to the internet, then try again.' }
  }
  if (kinds.has('network')) {
    return { title: "We couldn't reach the server", body: 'Check your connection, then try again.' }
  }
  if (kinds.has('http')) {
    return {
      title: 'Something went wrong on our side',
      body: 'This is usually temporary. Please try again in a moment.',
    }
  }
  return {
    title: "We couldn't read the latest services",
    body: 'Please try again. If it keeps happening, the data may be updating.',
  }
}
