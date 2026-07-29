import type { RequestContext, RequestHandler } from "../router.types"

/** Redirects non-www requests to the www subdomain. */
export function www({ secure }: { readonly secure?: boolean }): RequestHandler {
  return ({ url }: RequestContext) => {
    const target = new URL(url.href)
    if (!target.hostname.startsWith("www.")) {
      target.hostname = `www.${target.hostname}`
    }
    if (secure && target.protocol !== "https:") {
      target.protocol = "https:"
    }
    if (target.href === url.href) {
      return
    }
    return Response.redirect(target, 301)
  }
}
