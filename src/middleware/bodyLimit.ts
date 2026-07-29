import { HTTP } from "../HTTP"
import type { RequestContext, RouteMiddleware } from "../router.types"

export type BodyLimitOptions = {
  readonly maxSize?: number
  readonly contentTypes?: string[]
}

/**
 * Rejects requests exceeding a body size or with disallowed content types.
 *
 * Enforces the declared `Content-Length` header only; streamed request
 * bodies are not measured.
 */
export function bodyLimit(options?: BodyLimitOptions): RouteMiddleware {
  const maxSize = options?.maxSize ?? 1_048_576
  const contentTypes = options?.contentTypes?.map((type) =>
    type.trim().toLowerCase(),
  )

  return {
    before: ({ request }: RequestContext) => {
      const contentLength = request.headers.get(HTTP.header.ContentLength)
      if (contentLength !== null) {
        const size = Number.parseInt(contentLength, 10)
        if (!Number.isFinite(size) || size < 0) {
          return reject(HTTP.status.BadRequest, HTTP.statusText.BadRequest)
        }
        if (size > maxSize) {
          return reject(
            HTTP.status.PayloadTooLarge,
            HTTP.statusText.PayloadTooLarge,
          )
        }
      }

      if (contentTypes) {
        const contentType = request.headers.get(HTTP.header.ContentType)
        const mediaType = contentType?.split(";")[0].trim().toLowerCase()
        if (mediaType && !contentTypes.includes(mediaType)) {
          return reject(
            HTTP.status.UnsupportedMediaType,
            HTTP.statusText.UnsupportedMediaType,
          )
        }
      }
    },
  }
}

function reject(status: number, statusText: string) {
  return Response.json({ error: statusText }, { status, statusText })
}
