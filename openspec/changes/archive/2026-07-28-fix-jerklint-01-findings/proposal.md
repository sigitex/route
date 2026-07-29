# Fix jerklint-01 Findings

## Why

The jerklint-01 review found 19 defects in the router core and middleware; `.internal/review/plan-01.md` groups 14 of them into five phases. The worst are cross-request state leaks and a dispatch lifecycle that discards after-middleware work — correctness bugs that affect every consumer, so they must land before the API surface hardens.

## What Changes

- **Router lifecycle** (findings 1, 2, 17): run global middleware once per request instead of once per candidate handler; unwind after-hooks in reverse registration order; return the same `Response` instance that after-hooks decorated (currently a fresh `respond(result)` discards their header mutations for plain-object results); make `bind` synchronous; rewrite `use()` to delegate to `dispatch()` instead of casting after-hooks into before-hooks around `noop`.
- **Request isolation** (findings 3, 4, 19): move per-request state in `cookies()` and `rateLimit()` out of factory closures into request scope; make `bind()` a scoped overlay that unwinds when nested `dispatch()` returns so `prefix()`/`pattern()` stop mutating the parent context's `url`/`params`; snapshot constructor/factory inputs (handler + middleware arrays, phase-sensitive option arrays).
- **Matching and errors** (finding 5): **BREAKING** — method-mismatched `pattern()` candidates fall through instead of short-circuiting with 405; router aggregates path-matched methods and returns 405 with an `Allow` header only after all handlers miss; `Router.route()` catch boundary serializes `RouterError` by its status instead of always 500; **BREAKING** — rename `RouterError.code` to `RouterError.status`.
- **Middleware correctness** (findings 8, 9, 10, 12, 16, 18): `bodyLimit` validates `Content-Length` parsing and matches media types exactly; `cors` requires `Access-Control-Request-Method` for preflight and rejects wildcard-origin + credentials at construction; `cache` appends `Vary` tokens instead of replacing; `www`/`https` clone the URL before redirecting and fix double-`www.` prefixing; `csp` derives directives from one `as const` key tuple and snapshots source arrays; `rateLimit` validates `window`/`max` and documents fixed-window semantics; `prefix` matches the exact root path (no trailing slash).
- **Asset contract** (finding 14): `Assets.static()` documented and enforced as absolute-pathname; `assets()` handler drops its redundant 404 check — adapters alone signal missing files with `undefined`.

Deferred (per plan): findings 6, 7, 11, 13, 15.

## Capabilities

### New Capabilities

- `router-lifecycle`: request dispatch order — global middleware phases, after-hook unwind order, response finalization, error boundary behavior.
- `request-isolation`: request-scoped state — scoped `bind()` overlays for nested dispatch, per-request middleware state, snapshot of constructor/factory inputs.
- `route-matching`: method/path matching — 405 fallthrough with aggregated `Allow` header, prefix root matching.
- `middleware-hardening`: correctness requirements for `bodyLimit`, `cors`, `cache`, `www`/`https`, `csp`, `rateLimit`.
- `asset-serving`: pathname contract between `Assets` adapters and the `assets()` handler.

### Modified Capabilities

None — no existing specs in `openspec/specs/`.

## Impact

- **Core:** `src/Router.ts`, `src/router.types.ts`, `src/RouterError.ts`, `src/handler/use.ts`, `src/handler/prefix.ts`, `src/handler/pattern.ts`.
- **Middleware:** `bodyLimit.ts`, `cors.ts`, `cache.ts`, `cookies.ts`, `csp.ts`, `https.ts`, `rateLimit.ts`, `www.ts`.
- **Assets:** `src/Assets.ts`, `src/handler/assets.ts`, `src/bun/bun.ts`, `src/cloudflare/cloudflare.ts`.
- **Breaking API:** `RouterError.code` → `RouterError.status`; `pattern()` no longer returns 405 directly (405 now emitted by the router with `Allow`); `bind()` becomes scoped (no longer leaks into parent scope after nested dispatch returns); `cors({ origin: "*", credentials: true })` now throws.
- Both Bun and Cloudflare adapters affected; plan calls for manual smoke tests on both before merging Phase 1.
