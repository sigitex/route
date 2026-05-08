import type { RequestContext, RequestHandler } from "../router.types"

/** Higher-order function that conditionally runs a handler based on a predicate. */
export function filter(
  predicate: (context: RequestContext) => boolean | Promise<boolean>,
): (handler: RequestHandler) => RequestHandler {
  return (handler) => async (context: RequestContext) => {
    if (!(await predicate(context))) {
      return
    }
    return context.dispatch(handler, [])
  }
}
