import type {
  RequestContext,
  RequestHandler,
  RouteMiddleware,
} from "../router.types"
import { use } from "./use"

/** Groups handlers under a URL prefix, stripping it before dispatch. */
export function prefix(
  prefix: string,
  ...handlers: RequestHandler[]
): RequestHandler
export function prefix(
  prefix: string,
  middlewares: RouteMiddleware[],
  ...handlers: RequestHandler[]
): RequestHandler
export function prefix(
  prefix: string,
  head: RouteMiddleware[] | RequestHandler,
  ...tail: RequestHandler[]
): RequestHandler {
  const [middlewares, handlers] = Array.isArray(head)
    ? [head, tail]
    : [[], [head, ...tail]]
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix
  const root = base + "/"
  const handle = use(middlewares, ...handlers)
  return async (context: RequestContext) => {
    const { pathname } = context.url
    if (pathname !== base && !pathname.startsWith(root)) {
      return
    }
    const previous = context.url
    const url = new URL(previous.href)
    url.pathname = pathname === base ? "/" : pathname.slice(base.length)
    context.bind({ url })
    try {
      return await handle(context)
    } finally {
      context.bind({ url: previous })
    }
  }
}
