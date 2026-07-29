import type { Container } from "@sigitex/bind"
import { RouterError } from "./RouterError"
import type {
  RequestContext,
  RequestHandler,
  RouteMiddleware,
  RouterBind,
  RouterDispatch,
  RouterOptions,
} from "./router.types"

/** Core router that dispatches requests through a handler chain. */
export class Router {
  private readonly handlers: RequestHandler[]
  private readonly container: Container | undefined
  private readonly middlewares: RouteMiddleware[]

  constructor(handlers: RequestHandler[], options: RouterOptions = {}) {
    this.handlers = [...handlers]
    this.container = options.container
    this.middlewares = [...(options.middlewares ?? [])]
  }

  async route(request: Request, env: Env): Promise<Response> {
    const { handlers } = this
    const allowed = new Set<string>()
    try {
      const root = createRootScope(
        {
          request,
          env,
          url: new URL(request.url),
          allow: (method: string) => {
            allowed.add(method)
          },
        },
        this.container,
      )
      const candidates: RequestHandler = async (context: RequestContext) => {
        for (const handler of handlers) {
          const result = await handler(context)
          if (result !== undefined) {
            return result
          }
        }
        if (allowed.size > 0) {
          const response = fail(405, "Method not allowed.")
          response.headers.set("Allow", [...allowed].toSorted().join(", "))
          return response
        }
        return fail(404, "Not found.")
      }
      const response = await dispatch(root, candidates, this.middlewares)
      return response ?? fail(404, "Not found.")
    } catch (error) {
      if (error instanceof RouterError) {
        return fail(error.status, error.message)
      }
      console.error(error)
      return fail(500, "Internal server error.")
    }
  }
}

// oxlint-disable-next-line typescript/no-explicit-any
type Bindings = { [key: string]: any }

type ScopeContext = Bindings & {
  bind: RouterBind
  dispatch: RouterDispatch
}

/** One dispatch-level binding scope; unwinds when its dispatch returns. */
type Scope =
  | { readonly context: ScopeContext }
  | { readonly container: Container }

async function dispatch(
  parent: Scope,
  handler: RequestHandler,
  middlewares: RouteMiddleware[],
  bindings?: Bindings,
): Promise<Response | undefined> {
  const scope = createScope(parent)
  if (bindings) {
    bind(scope, bindings)
  }
  let entered = 0
  for (const { before } of middlewares) {
    entered++
    if (!before) {
      continue
    }
    const interrupt = await invoke(scope, before)
    if (interrupt !== undefined) {
      return finalize(scope, interrupt, middlewares, entered)
    }
  }
  const result = await invoke(scope, handler)
  if (result === undefined) {
    return undefined
  }
  return finalize(scope, result, middlewares, entered)
}

async function finalize(
  scope: Scope,
  result: unknown,
  middlewares: RouteMiddleware[],
  entered: number,
): Promise<Response> {
  let response = respond(result)
  bind(scope, { response })
  for (let index = entered - 1; index >= 0; index--) {
    const { after } = middlewares[index]
    if (!after) {
      continue
    }
    const replacement = await invoke(scope, after)
    if (replacement !== undefined) {
      response = respond(replacement)
      bind(scope, { response })
    }
  }
  return response
}

function createRootScope(
  values: Bindings,
  container: Container | undefined,
): Scope {
  if (container) {
    const cloned = container.clone()
    cloned.bind(values)
    return containerScope(cloned)
  }
  return contextScope(values as ScopeContext)
}

function createScope(parent: Scope): Scope {
  if ("container" in parent) {
    return containerScope(parent.container.clone())
  }
  return contextScope(Object.create(parent.context) as ScopeContext)
}

function containerScope(container: Container): Scope {
  const scope: Scope = { container }
  const scopedBind: RouterBind = (bindings) => {
    container.bind(bindings)
  }
  const scopedDispatch: RouterDispatch = (handler, middlewares, bindings) =>
    dispatch(scope, handler, middlewares, bindings)
  container.bind({ bind: scopedBind, dispatch: scopedDispatch })
  return scope
}

function contextScope(context: ScopeContext): Scope {
  const scope: Scope = { context }
  context.bind = (bindings) => {
    Object.assign(context, bindings)
  }
  context.dispatch = (handler, middlewares, bindings) =>
    dispatch(scope, handler, middlewares, bindings)
  return scope
}

function invoke(scope: Scope, handler: RequestHandler) {
  return "container" in scope
    ? scope.container.call(handler)
    : handler(scope.context)
}

function bind(scope: Scope, bindings: Bindings) {
  if ("container" in scope) {
    scope.container.bind(bindings)
  } else {
    Object.assign(scope.context, bindings)
  }
}

function respond(result: unknown) {
  return result instanceof Response
    ? result
    : Response.json(result)
}

function fail(status: number, error: string) {
  return Response.json({ error }, {
    status,
    statusText: error,
  })
}
