# Tasks — fix-jerklint-01-findings

## 1. Router lifecycle (plan Phase 1)

- [x] 1.1 Rework `dispatch()` in `src/Router.ts`: single `respond(result)`, bind `{ response }`, run after-hooks in reverse registration order against it, return the final bound `Response` (after-hook return value replaces it)
- [x] 1.2 Move `RouterOptions.middlewares` execution out of the per-candidate loop: `route()` runs one dispatch wrapping the whole candidate loop; before short-circuits unwind through already-run after-hooks
- [x] 1.3 Rewrite `use()` in `src/handler/use.ts` to delegate to `context.dispatch(composite, middlewares)`; delete the `noop`-wrapped after-as-before casting
- [x] 1.4 Remove `async` from `bind` in `src/Router.ts`; confirm `RouterBind` in `src/router.types.ts` stays `(...) => void`
- [x] 1.5 Smoke-test Phase 1 manually against the Bun and Cloudflare adapters (per plan risk note)

## 2. Request isolation (plan Phase 2)

- [x] 2.1 Implement scoped bind overlays: each `dispatch()` pushes a child scope (`Object.create` chain or per-scope container clone); `bind()` writes to the innermost scope; scope unwinds when dispatch returns
- [x] 2.2 `src/handler/prefix.ts`: bind stripped `url` into the child scope only; parent `url` intact after fallthrough. Same for `params` in `src/handler/pattern.ts`
- [x] 2.3 `src/middleware/cookies.ts`: move `parsed`/`pending` into the `before` hook; pass `pending` to `after` via scoped binding
- [x] 2.4 `src/middleware/rateLimit.ts`: move `lastResult` into the `before` hook; pass to `after` via scoped binding; keep `store`/config in factory closure
- [x] 2.5 `src/Router.ts` constructor: shallow-copy `handlers` and `middlewares` arrays
- [x] 2.6 Snapshot phase-sensitive middleware option arrays (bodyLimit content types, CORS lists, CSP sources)
- [x] 2.7 Resolve design open question: benchmark `Container.clone()` per dispatch vs. request-level container fallback

## 3. Method matching and error boundary (plan Phase 3)

- [x] 3.1 `src/handler/pattern.ts`: on path-match/method-mismatch, record method in per-request collector and return `undefined`
- [x] 3.2 `src/Router.ts`: after all candidates miss, return 405 + `Allow` header when collector non-empty, else 404
- [x] 3.3 `src/RouterError.ts`: rename `code` to `status`; update all references
- [x] 3.4 `src/Router.ts` catch block: `RouterError` ⇒ respond with its `status`/message, no log; other errors ⇒ `console.error` + 500

## 4. Middleware correctness (plan Phase 4)

- [x] 4.1 `src/middleware/bodyLimit.ts`: `Number.parseInt` + `Number.isFinite` guard rejecting NaN/negative; exact media-type compare (split `;`, trim, lowercase); JSDoc Content-Length-only note
- [x] 4.2 `src/middleware/cors.ts`: require `Access-Control-Request-Method` for preflight; throw at construction on `origin: "*"` + `credentials: true`
- [x] 4.3 `src/middleware/cache.ts`: `append` Vary instead of `set`
- [x] 4.4 `src/middleware/www.ts` + `src/middleware/https.ts`: clone URL before transforming; decouple hostname/protocol checks in `www()`; redirect only when target differs
- [x] 4.5 `src/middleware/csp.ts`: directive keys as single `as const` tuple deriving `CspOptions` and directive map; shallow-copy source arrays at construction
- [x] 4.6 `src/middleware/rateLimit.ts`: construction-time asserts on `window`/`max`; JSDoc fixed-window
- [x] 4.7 `src/handler/prefix.ts`: accept `pathname === prefix` exactly, child pathname `"/"`

## 5. Asset pathname contract (plan Phase 5)

- [x] 5.1 `src/Assets.ts`: document absolute-pathname contract for `static()`; adapters in `src/bun/bun.ts` and `src/cloudflare/cloudflare.ts` enforce it
- [x] 5.2 `src/handler/assets.ts`: remove the `response.status === 404` check; fall through on `undefined` only
