import type {
  RequestContext,
  RequestHandler,
  RouteMiddleware,
} from "../router.types"

/** Applies middlewares to a group of handlers without creating a prefix. */
export function use(
  middlewares: RouteMiddleware[],
  ...handlers: RequestHandler[]
): RequestHandler {
  const composite: RequestHandler = async (context: RequestContext) => {
    for (const handler of handlers) {
      const result = await handler(context)
      if (result !== undefined) {
        return result
      }
    }
    return undefined
  }
  return ({ dispatch }: RequestContext) => dispatch(composite, middlewares)
}
