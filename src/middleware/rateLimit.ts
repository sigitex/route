import { HTTP } from "../HTTP"
import type {
  RequestContext,
  ResponseContext,
  RouteMiddleware,
} from "../router.types"

export type RateLimitStore = {
  increment(
    key: string,
    window: number,
  ): Promise<{ count: number; reset: number }>
}

export type RateLimitOptions = {
  readonly window?: number
  readonly max?: number
  readonly key?: (context: RequestContext) => string
  readonly store?: RateLimitStore
  readonly headers?: boolean
}

type RateLimitResult = { count: number; reset: number }

/**
 * IP-based rate limiting with pluggable storage.
 *
 * Uses a fixed-window algorithm: requests are counted per `window`-second
 * bucket, and every counter resets at each bucket boundary.
 */
export function rateLimit(options?: RateLimitOptions): RouteMiddleware {
  const window = options?.window ?? 60
  const max = options?.max ?? 100
  if (!Number.isFinite(window) || window <= 0) {
    throw new Error("rateLimit() requires a finite window greater than 0.")
  }
  if (!Number.isFinite(max) || max < 0) {
    throw new Error("rateLimit() requires a finite max of at least 0.")
  }
  const key = options?.key ?? rateLimit.ip
  const store = options?.store ?? rateLimit.memory()
  const headers = options?.headers ?? true

  return {
    before: async (context: RequestContext) => {
      const id = key(context)
      const result = await store.increment(id, window)
      context.bind({ __rateLimitResult: result })

      if (result.count > max) {
        return Response.json(
          { error: HTTP.statusText.TooManyRequests },
          {
            status: HTTP.status.TooManyRequests,
            statusText: HTTP.statusText.TooManyRequests,
          },
        )
      }
    },
    after: ({
      response,
      __rateLimitResult,
    }: ResponseContext & { __rateLimitResult: RateLimitResult }) => {
      if (headers) {
        const remaining = Math.max(0, max - __rateLimitResult.count)
        response.headers.set(HTTP.header.XRateLimitLimit, String(max))
        response.headers.set(HTTP.header.XRateLimitRemaining, String(remaining))
        response.headers.set(
          HTTP.header.XRateLimitReset,
          String(__rateLimitResult.reset),
        )
      }
    },
  }
}

export namespace rateLimit {
  export function ip({ request }: RequestContext): string {
    return (
      request.headers.get(HTTP.header.CFConnectingIP) ??
      request.headers.get(HTTP.header.XForwardedFor)?.split(",")[0]?.trim() ??
      "unknown"
    )
  }

  export function memory(): RateLimitStore {
    const windows = new Map<string, { count: number; reset: number }>()

    return {
      async increment(key: string, window: number) {
        const now = Math.floor(Date.now() / 1000)
        const windowStart = now - (now % window)
        const windowKey = `${key}:${windowStart}`
        const reset = windowStart + window

        const entry = windows.get(windowKey)
        if (entry) {
          entry.count++
          return { count: entry.count, reset }
        }

        windows.set(windowKey, { count: 1, reset })

        // Clean up expired windows
        for (const [k, v] of windows) {
          if (v.reset < now) {
            windows.delete(k)
          }
        }

        return { count: 1, reset }
      },
    }
  }
}
