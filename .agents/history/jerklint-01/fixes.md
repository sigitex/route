# Fixes — jerklint-01 (change: fix-jerklint-01-findings)

Gist of each change landed. Details in `openspec/changes/fix-jerklint-01-findings/`.

## Router lifecycle

- **`dispatch()` finalizes once** (`src/Router.ts`): one `respond(result)`, response bound to context, after-hooks run against that same instance, and the decorated (or replaced) `Response` is what the client receives. Previously a second `respond(result)` discarded after-hook header work on plain-object results.
- **After-hooks unwind in reverse registration order** — onion semantics. A before short-circuit still unwinds through the after-hooks of middleware that already ran.
- **Global middleware runs once per request**, wrapping the whole candidate loop, instead of once per candidate handler.
- **`use()` delegates to `dispatch()`** — the noop-handler trick that cast after-hooks into before-hooks is gone. Groups are transparent: no match ⇒ `undefined`, no after-hooks fire.
- **`bind` is synchronous** (returns `void`, no stray `async`).

## Request isolation

- **Scoped `bind()` overlays**: each `dispatch()` pushes a scope (`Object.create` chain, or `Container.clone()` in container mode) that unwinds when it returns. `dispatch(handler, middlewares, bindings?)` can seed the new scope.
- **`prefix()`/`pattern()` bind `url`/`params` into the child scope only** — sibling candidates no longer see a stripped `url` or stale `params` after fallthrough. Candidate handlers themselves run in the shared chain scope so adapter binds (`assets`) still persist across candidates.
- **`cookies()`/`rateLimit()` hold no per-request state in factory closures** — parsed cookies, pending Set-Cookie list, and rate-limit counters are created in `before` and passed to `after` via scoped bindings. Concurrent requests no longer cross-contaminate.
- **Inputs snapshotted**: `Router` copies `handlers`/`middlewares`; `bodyLimit`/`cors`/`csp` copy their option arrays at construction.
- **Container clone benchmark** (open question resolved): ~0.8–3.5 µs per clone; container-mode routing ≈ plain-mode. Per-dispatch cloning stays.

## Matching and errors

- **405 falls through** (BREAKING): `pattern()` records its method and returns `undefined` on method mismatch; a later route with the same path can match. Router emits `405` + aggregated sorted `Allow` header only after all candidates miss; plain `404` when no path matched. Both pass through global after-hooks.
- **`RouterError.code` → `RouterError.status`** (BREAKING).
- **Error boundary honors `RouterError`**: thrown `RouterError` ⇒ response with its status/message, not logged; other errors ⇒ `console.error` + 500.

## Middleware correctness

- **`bodyLimit`**: malformed/negative `Content-Length` ⇒ 400; exact media-type comparison (truncate at `;`, trim, lowercase) instead of prefix match; JSDoc states Content-Length-only enforcement.
- **`cors`**: OPTIONS is a preflight only with `Access-Control-Request-Method`; `origin: "*"` + `credentials: true` throws at construction (BREAKING).
- **`cache`**: appends `Vary` tokens instead of replacing.
- **`www`/`https`**: redirect from a URL clone (context `url` untouched); `www()` no longer double-prefixes and only redirects when the target differs.
- **`csp`**: directive keys are one `as const` tuple deriving both `CspOptions` and the directive names; source arrays snapshotted.
- **`rateLimit`**: throws on invalid `window`/`max`; JSDoc documents fixed-window algorithm.
- **`prefix`**: matches its exact root (`/api` without trailing slash), child pathname `"/"`; lookalikes (`/apiary`) don't match.

## Asset contract

- **`Assets.static()` takes an absolute pathname** — documented on the type; both adapters normalize via `Assets.pathname()`.
- **`assets()` handler falls through on `undefined` only** — the 404 sniff is removed, so adapters can intentionally serve 404 pages.

Deferred (per plan): findings 6, 7, 11, 13, 15.
