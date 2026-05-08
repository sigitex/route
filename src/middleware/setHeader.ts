import type { ResponseContext, ResponseHandler } from "../router.types"

/** Sets a header on every response. */
export function setHeader(header: string, value: string): ResponseHandler {
  return ({ response }: ResponseContext) => {
    response.headers.set(header, value)
  }
}
