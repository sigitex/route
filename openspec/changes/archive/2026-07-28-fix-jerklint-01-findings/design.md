# Design — fix-jerklint-01-findings

## Context

`Router.route()` iterates candidate handlers, calling `dispatch(handler, this.middlewares)` per candidate. This makes global middleware run once per *candidate* (not per request), runs after-hooks in registration order, and returns `respond(result)` a second time — discarding after-hook header mutations whenever the handler returned a plain object. `bind()` writes directly into the shared context (or container), so nested handlers (`prefix`, `pattern`) permanently mutate `url`/`params` for sibling candidates, and middleware factories (`cookies`, `rateLimit`) keep per-request state in factory closures shared across concurrent requests. Fixes are grouped in `.internal/review/plan-01.md` as five phases; this design covers all of them.

## Goals / Non-Goals

**Goals:**

- One global middleware pass per request; after-hooks unwind in reverse registration order; the decorated `Response` instance is what the client receives.
- Request- and scope-isolated bindings: no cross-request leaks, no sibling-candidate interference.
- Correct 405 semantics (fallthrough + aggregated `Allow`), `RouterError`-aware error boundary.
- Individual middleware correctness fixes (plan Phase 4) and asset pathname contract (Phase 5).

**Non-Goals:**

- Typed handler contexts (finding 6), platform init API redesign (7), env declaration style (11), export pruning (13), automated test suite (15) — all deferred by the plan.
- Streamed body size enforcement in `bodyLimit` (documented limitation).

## Decisions

### D1. Lifecycle: global middleware moves from `dispatch()` to `route()`

`dispatch(handler, middlewares)` keeps its signature but becomes the *only* phase engine: run before-hooks in order (short-circuit on a returned value), invoke handler, `respond(result)` once, `bind({ response })`, run after-hooks in **reverse** order (an after-hook returning a value replaces the response), return the final bound `Response`. `route()` wraps its whole candidate loop in a single dispatch of a synthetic "try each handler" composite using `RouterOptions.middlewares`. A before short-circuit still passes through the after-hooks of middleware that already ran (reverse unwind), mirroring standard onion semantics.

*Alternative considered:* keep per-candidate dispatch and dedupe with a "ran already" flag — rejected; flag state is exactly the kind of shared mutable state Phase 2 removes.

### D2. `use()` delegates to `dispatch()`

`use(middlewares, ...handlers)` returns a handler that calls `context.dispatch(composite, middlewares)` where `composite` tries each inner handler in order. The `noop`-wrapping trick (casting after-hooks to before-hooks) is deleted; reverse unwind comes from D1 for free. If the composite yields no result, `dispatch` returns `undefined` and no after-hooks run (nothing matched — the group is transparent).

### D3. Scoped `bind()` overlays

Each `dispatch()` call pushes a scope. `bind()` writes into the current (innermost) scope; lookups walk outward. Implementation: child context via `Object.create(parentContext)` with own-property assignment, so unwinding is automatic when dispatch returns and the parent object is never mutated. `prefix()` binds its stripped `url` (and `pattern()` its `params`) into the child scope only; on fallthrough the parent's `url` is untouched. Mechanism: `dispatch(handler, middlewares, bindings?)` accepts optional seed bindings applied to the new scope before any hook runs — `prefix()`/`pattern()` pass `url`/`params` there. Candidate handlers themselves are invoked directly inside the chain scope (not one dispatch per candidate), so adapter-style binds (`bun()`, `cloudflare()` binding `assets`) persist across sibling candidates as before. With a container configured, the container is cloned per scope so `container.call()` resolves scoped values; if `@sigitex/bind` cloning proves too costly per dispatch, fall back to binding a prototype-chained context object into a single request-level container (see Open Questions).

*Alternative considered:* explicit save/restore of mutated keys — rejected; requires every binder to know what it clobbers, and misses concurrent access.

### D4. 405 aggregation at the router

`pattern()` on path-match/method-mismatch returns `undefined` (fallthrough) after recording its method into a per-request collector (a `Set` created in `route()` and reachable through context). After all candidates miss: collector non-empty ⇒ `405` with `Allow: <sorted methods>`; empty ⇒ `404`.

### D5. Error boundary honors `RouterError`

`route()`'s catch: `error instanceof RouterError` ⇒ respond with `error.status` / `error.message`, no logging; otherwise `console.error` + 500. `RouterError.code` renamed to `status` (**breaking**) — it is an HTTP status, not an app error code.

### D6. Request-scoped middleware state

`cookies()` and `rateLimit()` create their per-request values (`parsed`/`pending`, `lastResult`) inside `before` and pass them to `after` via scoped bindings (D3), e.g. `bind({ __cookiesPending: pending })`. Factory closures retain only process-wide immutable config (options, `store`).

### D7. Input snapshots

`Router` constructor slices `handlers` and `middlewares`. Middleware factories slice phase-sensitive option arrays (`bodyLimit.contentTypes`, `cors` origin/method/header lists, `csp` source arrays) at construction. `csp` directive keys become a single `as const` tuple from which both `CspOptions` keys and the directive-name map derive.

### D8. Middleware point fixes (plan 4A–4G)

- `bodyLimit`: `Number.parseInt` + `Number.isFinite` guard, reject NaN/negative `Content-Length`; exact media-type compare (split on `;`, trim, lowercase); JSDoc states Content-Length-only enforcement.
- `cors`: preflight requires `Access-Control-Request-Method`; `origin: "*"` + `credentials: true` throws at construction.
- `cache`: `headers.append(Vary, …)` instead of `set`.
- `www`/`https`: operate on `new URL(url.href)` clone; `www()` decouples hostname and protocol checks, redirects only when target differs.
- `rateLimit`: constructor asserts finite `window > 0`, finite `max >= 0`; JSDoc says fixed-window.
- `prefix`: also match `pathname === prefix` (no trailing slash), child pathname `"/"`.

### D9. Asset pathname contract

`Assets.static(path)` takes an absolute pathname (leading `/`) — documented on the type, enforced by adapters (throw or normalize on violation). `assets()` handler treats only `undefined` from `Assets.file()` as miss; the 404 sniff is removed (Cloudflare adapter already maps 404 to `undefined`; Bun adapter already returns `undefined` on missing file).

## Risks / Trade-offs

- [Dispatch semantics change under every consumer] → Phase 1 developed on a branch; manual smoke tests against Bun and Cloudflare adapters before merge (per plan).
- [Scoped bind may hide bindings consumers expected to escape nested dispatch] → Breaking change documented in proposal; response binding happens at the scope running the middleware chain, so global after-hooks still see it.
- [Container clone-per-scope cost in @sigitex/bind] → measure; fallback path in D3.
- [405 behavior change breaks clients relying on eager 405] → semantically more correct (later routes can still match); release note.
- [Reverse after-unwind changes observable header order for existing multi-middleware stacks] → intended fix (finding 17-adjacent); note in changelog.

## Migration Plan

Phases land in plan order — 1 (lifecycle) → 2 (isolation) → 3 (matching/errors) → 4 (middleware) → 5 (assets). Phase 1 on its own branch with adapter smoke tests; later phases individual commits. Rollback = revert the phase commit; no data migrations.

## Open Questions

- ~~Does `@sigitex/bind` `Container.clone()` cost permit per-dispatch cloning?~~ **Resolved (benchmarked on Bun 1.3):** `clone()` costs ~0.8 µs at 10 bindings, ~3.5 µs at 40; end-to-end, container mode routes at 10.7 µs/request vs 10.6 µs/request for plain contexts on a realistic prefix + pattern + middleware tree. Per-dispatch cloning stays; the request-level-container fallback is not needed.
- ~~Collector transport for D4~~ **Resolved:** dedicated context key — the router binds `allow(method)` into the root scope (typed on `RequestContext`); `pattern()` calls it on method mismatch.
