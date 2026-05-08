# @sigitex/route

A server-side web framework.

`bun add @sigitex/route`

> **Note:** This package currently exports TypeScript sources directly. A TypeScript-compatible runtime or bundler (Bun, etc.) is required.

## Quick Start

```ts
import { route, get, post, prefix, cors, hardened, cookies } from "@sigitex/route"
import { bun } from "@sigitex/route/bun"

const fetch = route(
  bun({ assets: "./public" }),
  get("/health", () => ({ status: "ok" })),
  prefix("/api/", [cors(), cookies(), hardened()],
    get("/users", async () => {
      return Response.json(await getUsers())
    }),
    get("/users/:id", async ({ params }: { params: { id: string } }) => {
      return Response.json(await getUser(params.id))
    }),
    post("/users", async ({ request }: { request: Request }) => {
      const body = await request.json()
      return Response.json(await createUser(body))
    }),
  ),
)

Bun.serve({ fetch })
```

On Cloudflare Workers:

```ts
import { route, get } from "@sigitex/route"
import { cloudflare } from "@sigitex/route/cloudflare"

export default {
  fetch: route(
    cloudflare(),
    get("/hello", () => ({ hello: "world" })),
  ),
}
```

## Entry Points

| Import                      | Description                         |
| --------------------------- | ----------------------------------- |
| `@sigitex/route`            | Core router, handlers, middleware   |
| `@sigitex/route/bun`        | Bun runtime adapter                |
| `@sigitex/route/cloudflare` | Cloudflare Workers runtime adapter  |

## `route(...handlers)`

Creates a fetch function `(request: Request, env: Env) => Promise<Response>` from a list of handlers. Handlers are tried in order; the first to return a value produces the response. If none match, a 404 is returned.

```ts
const fetch = route(handler1, handler2, handler3)
```

An optional `RouterOptions` object can be passed as the first argument:

```ts
const fetch = route({ container, middlewares: [cors()] }, handler1, handler2)
```

Falsy values (`null`, `undefined`, `false`, `0`) are silently ignored, allowing conditional handlers:

```ts
route(
  isDev && get("/debug", debugHandler),
  get("/", homeHandler),
)
```

### `RouterOptions`

| Option        | Type              | Description                                            |
| ------------- | ----------------- | ------------------------------------------------------ |
| `container`   | `Container`       | A `@sigitex/bind` IoC container for dependency injection |
| `middlewares`  | `RouteMiddleware[]` | Global middlewares applied to every dispatched handler  |

## Handlers

Handlers are functions that receive a context object and return a `Response`, a JSON-serializable value, or `undefined` to skip.

### `get(path, handler, ...middlewares)`

Matches GET requests against `path`. Path parameters use `regexparam` syntax (`:param`, `*`).

```ts
get("/users/:id", ({ params }: { params: { id: string } }) => {
  return Response.json({ id: params.id })
})
```

### `post(path, handler, ...middlewares)`

Matches POST requests.

### `put(path, handler, ...middlewares)`

Matches PUT requests.

### `del(path, handler, ...middlewares)`

Matches DELETE requests.

### `patch(path, handler, ...middlewares)`

Matches PATCH requests.

### `pattern(method, path, handler, ...middlewares)`

Generic version -- pass `null` as the method to match any HTTP method.

```ts
pattern(null, "/any-method/:id", handler)
pattern("GET", "/explicit", handler)
```

### `prefix(prefix, ...handlers)`

Groups handlers under a URL prefix. The prefix is stripped from the URL before child handlers see it.

```ts
prefix("/api/v1/",
  get("/users", listUsers),   // matches /api/v1/users
  get("/posts", listPosts),   // matches /api/v1/posts
)
```

Accepts an optional middlewares array as the second argument:

```ts
prefix("/api/", [cors(), bodyLimit()],
  post("/upload", uploadHandler),
)
```

### `mount(fetchFn)`

Wraps a standard `(request: Request) => Promise<Response>` function as a handler. Useful for mounting sub-applications or external fetch handlers.

```ts
mount(subApp.fetch)
```

### `assets()`

Serves static files via the platform's `Assets` binding. Returns `undefined` on 404 so subsequent handlers can match.

```ts
route(bun(), assets(), get("/", homeHandler))
```

### `app(routes)`

Serves `index.html` for paths matching a client-side `RouteTree`. Intended for single-page applications where the client handles routing.

```ts
app({
  users: "/users",
  user: "/users/:id",
  settings: { general: "/settings/general" },
})
```

### `noop`

A handler that does nothing and returns `undefined`. Used internally by middleware composition.

### `use(middlewares, ...handlers)`

Applies a set of middlewares to a group of handlers without creating a prefix.

```ts
use([cors(), cookies()],
  get("/a", handlerA),
  get("/b", handlerB),
)
```

### `filter(predicate)`

Higher-order function that conditionally runs a handler based on a predicate.

```ts
const onlyJson = filter(({ request }) =>
  request.headers.get("Accept")?.includes("application/json") ?? false
)

onlyJson(get("/data", dataHandler))
```

### `https()`

Redirects HTTP requests to HTTPS with a 301.

```ts
route(https(), get("/", homeHandler))
```

### `www(options)`

Redirects non-www requests to the www subdomain.

```ts
www({ secure: true })  // also upgrades to https
```

## Middleware

Middlewares are objects with optional `before` and `after` hooks. `before` runs before the handler; `after` runs after. Either can return a `Response` to short-circuit.

```ts
const myMiddleware: RouteMiddleware = {
  before: ({ request, bind }) => {
    bind({ startTime: Date.now() })
  },
  after: ({ response, startTime }) => {
    response.headers.set("X-Duration", String(Date.now() - startTime))
  },
}
```

### `cors(options?)`

Handles CORS preflight and response headers.

| Option          | Type                                              | Default    |
| --------------- | ------------------------------------------------- | ---------- |
| `origin`        | `string \| string[] \| (origin: string) => boolean` | `"*"`      |
| `methods`       | `string[]`                                        | all standard |
| `allowHeaders`  | `string[]`                                        | mirrors request |
| `exposeHeaders` | `string[]`                                        | --         |
| `credentials`   | `boolean`                                         | `false`    |
| `maxAge`        | `number`                                          | --         |

### `cookies()`

Parses request cookies and collects `Set-Cookie` headers on the response. Binds a `Cookies` object to context:

```ts
cookies.get("session")           // read
cookies.set("session", token, {  // write
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 86400,
  path: "/",
})
```

#### `CookieOptions`

`domain`, `expires`, `httpOnly`, `maxAge`, `path`, `sameSite` (`"strict" | "lax" | "none"`), `secure`.

### `bodyLimit(options?)`

Rejects requests exceeding a body size or with disallowed content types.

| Option         | Type       | Default   |
| -------------- | ---------- | --------- |
| `maxSize`      | `number`   | 1 MB      |
| `contentTypes` | `string[]` | any       |

### `cache(options)`

Sets `Cache-Control` (and optionally `Vary`) headers on responses.

```ts
cache({ public: true, maxAge: 3600 })
cache("no-store")
```

#### `CacheOptions`

`public`, `private`, `maxAge`, `sMaxAge`, `noCache`, `noStore`, `mustRevalidate`, `proxyRevalidate`, `immutable`, `staleWhileRevalidate`, `staleIfError`, `vary`.

### `csp(options)`

Sets `Content-Security-Policy` headers. Supports automatic nonce generation via the `CSP.nonce` symbol -- the nonce is bound to context as `cspNonce`.

```ts
import { CSP } from "@sigitex/route"

csp({
  defaultSrc: [CSP.self],
  scriptSrc: [CSP.self, CSP.nonce],
  styleSrc: [CSP.self, CSP.unsafeInline],
  imgSrc: [CSP.self, CSP.data],
  reportOnly: true,
})
```

### `csrf(options?)`

Double-submit cookie CSRF protection. Requires `cookies()` in the middleware stack.

| Option    | Type       | Default                          |
| --------- | ---------- | -------------------------------- |
| `cookie`  | `string`   | `"csrf-token"`                   |
| `header`  | `string`   | `"X-CSRF-Token"`                 |
| `methods` | `string[]` | POST, PUT, PATCH, DELETE         |

### `rateLimit(options?)`

IP-based rate limiting with pluggable storage.

| Option    | Type               | Default                  |
| --------- | ------------------ | ------------------------ |
| `window`  | `number` (seconds) | `60`                     |
| `max`     | `number`           | `100`                    |
| `key`     | `(ctx) => string`  | `rateLimit.ip`           |
| `store`   | `RateLimitStore`   | `rateLimit.memory()`     |
| `headers` | `boolean`          | `true`                   |

Built-in helpers:

- `rateLimit.ip` -- key extractor using `CF-Connecting-IP` or `X-Forwarded-For`
- `rateLimit.memory()` -- in-memory sliding window store

### `hardened(options?)`

Convenience bundle applying `noSniff`, `frameGuard`, `referrerPolicy`, and `hsts`. Any can be disabled:

```ts
hardened()                              // all defaults
hardened({ hsts: false })               // skip HSTS
hardened({ frameGuard: "sameOrigin" })  // override frame guard
```

### `hsts(options?)`

Sets `Strict-Transport-Security`. Defaults: `max-age=31536000; includeSubDomains`.

| Option              | Type      | Default     |
| ------------------- | --------- | ----------- |
| `maxAge`            | `number`  | `31536000`  |
| `includeSubDomains` | `boolean` | `true`      |
| `preload`           | `boolean` | `false`     |

### `noSniff`

Sets `X-Content-Type-Options: nosniff`.

### `frameGuard.deny` / `frameGuard.sameOrigin`

Sets `X-Frame-Options`.

### `referrerPolicy.*`

Pre-built policies: `noReferrer`, `noReferrerWhenDowngrade`, `origin`, `originWhenCrossOrigin`, `sameOrigin`, `strictOrigin`, `strictOriginWhenCrossOrigin`, `unsafeUrl`.

### `requestId(options?)`

Reads or generates a request ID, binds it to context as `requestId`, and echoes it on the response.

| Option     | Type           | Default              |
| ---------- | -------------- | -------------------- |
| `header`   | `string`       | `"X-Request-Id"`     |
| `generate` | `() => string` | `crypto.randomUUID`  |

### `setHeader(header, value)`

Sets a header on every response. Returns a `ResponseHandler` (use as an `after` hook).

```ts
{ after: setHeader("X-Powered-By", "sigitex") }
```

## Errors

Error classes that can be thrown from handlers:

| Class              | Status | Default Message          |
| ------------------ | ------ | ------------------------ |
| `RouterError`      | any    | --                       |
| `NotFound`         | 404    | `"Not found."`           |
| `MethodNotAllowed` | 405    | `"Method not allowed."`  |
| `InvalidRequest`   | 400    | `"Invalid request."`     |
| `ServerError`      | --     | `"Internal error."`      |
