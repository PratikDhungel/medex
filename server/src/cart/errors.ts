/** An error the API returns as `{ code, message, details? }` with its HTTP status */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  toJSON() {
    return { code: this.code, message: this.message, ...(this.details === undefined ? {} : { details: this.details }) }
  }
}
