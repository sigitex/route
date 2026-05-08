import type { RequestContext, RequestHandler } from "../router.types"

/** Redirects HTTP requests to HTTPS with a 301. */
export function https(): RequestHandler {
  return ({ url }: RequestContext) => {
    if (url.protocol === "https:") {
      return
    }
    url.protocol = "https:"
    return Response.redirect(url, 301)
  }
}
