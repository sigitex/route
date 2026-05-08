// oxlint-disable typescript/no-explicit-any
import type { Container } from "@sigitex/bind"

/** Nested map of route names to path patterns for client-side routing. */
export type RouteTree = {
  [key: string]: string | RouteTree
}

/** The fetch function signature returned by `route()`. */
export type RouterFetch = (
  request: Request,
  env: Env,
) => Promise<Response>

/** Context object passed to request handlers. */
export type RequestContext = {
  readonly request: Request
  readonly env: Env
  readonly url: URL
  readonly bind: RouterBind
  readonly dispatch: RouterDispatch
}

/** Adds values to the current request context. */
export type RouterBind = (bindings: { [key: string]: any }) => void

/** Dispatches a handler through a middleware chain. */
export type RouterDispatch = (
  handler: RequestHandler,
  middlewares: RouteMiddleware[],
) => Promise<Response | undefined>

/** Context available to after-middleware, includes the response. */
export type ResponseContext = RequestContext & {
  readonly response: Response
}

/** A function that handles a request and optionally returns a response. */
export type RequestHandler = (
  context: any,
) => unknown

/** A function that runs after a response is produced. */
export type ResponseHandler = (
  context: any,
) => unknown

/** Options for the `route()` entry point. */
export type RouterOptions = {
  readonly container?: Container
  readonly middlewares?: RouteMiddleware[]
}

/** A middleware with optional before/after hooks. */
export type RouteMiddleware = {
  readonly before?: RequestHandler
  readonly after?: ResponseHandler
}
