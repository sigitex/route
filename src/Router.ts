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
      const runtime = createRuntime(
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
      const response = await runtime.dispatch(candidates, this.middlewares)
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

type Runtime = {
  readonly bind: RouterBind
  readonly dispatch: RouterDispatch
  readonly invoke: (handler: RequestHandler) => unknown
}

function createRuntime(
  values: Bindings,
  container: Container | undefined,
): Runtime {
  if (container) {
    const cloned = container.clone()
    const bind: RouterBind = (bindings) => {
      cloned.bind(bindings)
    }
    const runtime: Runtime = {
      bind,
      dispatch: (handler, middlewares) => dispatch(runtime, handler, middlewares),
      invoke: (handler) => cloned.call(handler),
    }
    cloned.bind({
      ...values,
      bind,
      dispatch: runtime.dispatch,
    })
    return runtime
  }

  const context: Bindings = { ...values }
  const bind: RouterBind = (bindings) => {
    Object.assign(context, bindings)
  }
  const runtime: Runtime = {
    bind,
    dispatch: (handler, middlewares) => dispatch(runtime, handler, middlewares),
    invoke: (handler) => handler(context),
  }
  context.bind = bind
  context.dispatch = runtime.dispatch
  return runtime
}

async function dispatch(
  runtime: Runtime,
  handler: RequestHandler,
  middlewares: RouteMiddleware[],
): Promise<Response | undefined> {
  let entered = 0
  for (const { before } of middlewares) {
    entered++
    if (!before) {
      continue
    }
    const interrupt = await runtime.invoke(before)
    if (interrupt !== undefined) {
      return finalize(runtime, interrupt, middlewares, entered)
    }
  }
  const result = await runtime.invoke(handler)
  if (result === undefined) {
    return undefined
  }
  return finalize(runtime, result, middlewares, entered)
}

async function finalize(
  runtime: Runtime,
  result: unknown,
  middlewares: RouteMiddleware[],
  entered: number,
): Promise<Response> {
  let response = respond(result)
  runtime.bind({ response })
  for (let index = entered - 1; index >= 0; index--) {
    const { after } = middlewares[index]
    if (!after) {
      continue
    }
    const replacement = await runtime.invoke(after)
    if (replacement !== undefined) {
      response = respond(replacement)
      runtime.bind({ response })
    }
  }
  return response
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
