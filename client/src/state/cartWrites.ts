/**
 * Orders the cart snapshots that writes return. Every PATCH and DELETE
 * response carries the whole cart, and responses can arrive in any order, so
 * a response to a request sent earlier must never overwrite one sent later.
 */
export class CartWrites {
  private sent = 0
  private applied = 0

  /** Call when sending; returns the request's sequence number */
  begin(): number {
    this.sent += 1
    return this.sent
  }

  /** True if this response is the newest so far and may replace the cached cart */
  accept(seq: number): boolean {
    if (seq < this.applied) return false
    this.applied = seq
    return true
  }
}
