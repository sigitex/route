# Plan 01 — Addressing jerklint-01 findings

This plan groups 14 of the 19 findings into five sequential phases, ordered by dependency: foundational lifecycle fixes first, then isolation, then correctness, then middleware, then assets. Each phase lists the findings it resolves, the files affected, and the concrete changes required.

**Deferred findings:** 6 (typed handlers — `any` context is by design), 7 (platform init API — current approach is fine), 11 (ambient env — staying with ambient declaration), 13 (exports/dead code — keeping wildcard exports, `__mount`, and `noop`), 15 (tests — not yet).

---

## Phase 1: Router lifecycle and response finalization

**Findings:** 1, 2, 17

The core dispatch loop has three intertwined defects: after-middleware decorations are discarded for plain-object results, global middleware runs per-candidate instead of once per request, and after-hooks unwind in registration order rather than reverse. These must be fixed together because they share the `Router.dispatch()` / `Router.route()` code path.

### 1A — Return the bound response, not a second `respond(result)` (finding 1)

**Files:** `src/Router.ts:57-86`

- In `dispatch()`, call `respond(result)` once and assign to `response`.
- Bind `{ response }`.
- Run after-hooks, which may mutate `response.headers`.
- Return the already-bound `response` (line 85), not a new `respond(result)`.

### 1B — Run global middleware once per request, not per candidate (finding 2)

**Files:** `src/Router.ts:21-46`, `src/handler/use.ts`

- Move `RouterOptions.middlewares` execution out of `dispatch()` and into `route()`, wrapping the entire handler loop.
- Run before-hooks once before iterating handlers.
- Run after-hooks once after a handler produces a result, or after a before short-circuit.
- Unwind after-hooks in reverse registration order.
- `use()` should delegate to `dispatch()` with its own middleware list rather than emulating phases by casting after-hooks into before-hooks around `noop`. Remove the `noop`-wrapping pattern from `use.ts:13-41` and have `use()` call `dispatch(handler, middlewares)` directly, with the same reverse-unwind semantics.

### 1C — Remove `async` from `bind` (finding 17)

**Files:** `src/Router.ts:49-55`, `src/router.types.ts:24-25`

- Remove `async` from the `bind` closure in `Router.route()`.
- Update `RouterBind` type to remain `(...) => void` (already is; just confirm no `Promise` wrapper).

---

## Phase 2: Request isolation and scoped bindings

**Findings:** 3, 4, 19

Shared mutable state across requests and unscoped `bind()` mutations cause cross-request leaks and sibling-handler interference. These fixes depend on the lifecycle changes in Phase 1.

### 2A — Make middleware factories request-scoped (finding 3)

**Files:** `src/middleware/cookies.ts:25-47`, `src/middleware/rateLimit.ts:24-68`

- `cookies()`: Move `parsed` and `pending` into the `before` hook so each request gets its own instances. Pass `pending` to `after` via a request-scoped binding (e.g., `bind({ __cookiesPending: pending })`) or by capturing in a closure created per-request.
- `rateLimit()`: Move `lastResult` into the `before` hook. Pass it to `after` via the same scoped mechanism. The `store` and configuration remain in the factory closure (they are process-wide and immutable).

### 2B — Scoped binding overlays for nested dispatch (finding 4)

**Files:** `src/Router.ts:49-55`, `src/handler/prefix.ts:26-35`, `src/handler/pattern.ts:25-36`

- `bind()` should push key-value pairs onto a scoped overlay that unwinds when the current `dispatch()` returns.
- `prefix()`: Stop mutating the parent context's `url`. Instead, pass the stripped URL through the child scope overlay. When `prefix` dispatch returns (match or fallthrough), the parent `url` is restored.
- `pattern()`: Same for `params` — bind into the child scope, not the parent context.

### 2C — Snapshot constructor inputs (finding 19)

**Files:** `src/Router.ts:15-18`

- Shallow-copy `handlers` and `middlewares` arrays in the `Router` constructor so later caller mutation has no effect.
- Middleware options that are phase-sensitive (body limit content types, CORS origins, CSP sources) should be snapshots. For arrays, slice in the middleware factory. For objects, `Object.freeze` or shallow-copy.

---

## Phase 3: Method matching and error boundary

**Findings:** 5

This is a standalone correctness fix to pattern matching and error serialization, but it depends on Phase 1's lifecycle being settled so error responses also go through after-hooks.

### 3A — Let method-mismatched candidates fall through (finding 5)

**Files:** `src/handler/pattern.ts:17-24`

- When pathname matches but method does not, return `undefined` (fallthrough) instead of `MethodNotAllowed`.
- Track pathname-matched-but-method-mismatched candidates at the `Router.route()` level. After all handlers have been tried, if any pathname matched but no method matched, return 405 with an `Allow` header listing the matched methods.

### 3B — Unified `RouterError` catch boundary (finding 5)

**Files:** `src/Router.ts:31-45`, `src/RouterError.ts`

- In the `catch` block of `Router.route()`, check if the error is a `RouterError`. If so, use its `code` and `message` for the response instead of always returning 500.
- Only `console.error` for unexpected (non-`RouterError`) errors.
- Rename `RouterError.code` to `RouterError.status` for clarity (it is an HTTP status, not an application error code).

---

## Phase 4: Middleware correctness

**Findings:** 8, 9, 10, 12, 16, 18

Individual middleware bugs. These are independent of each other and can be done in any order within this phase. They depend on Phase 1/2 being done so that after-hooks and scoping work correctly.

### 4A — `bodyLimit`: tighten predicate (finding 8)

**Files:** `src/middleware/bodyLimit.ts:10-42`

- Use `Number.parseInt` with a `Number.isFinite` guard; reject NaN/negative.
- Compare content type with exact media-type match (split on `;`, trim, lowercase compare) instead of `startsWith`.
- Document in JSDoc that this checks `Content-Length` only and does not enforce streamed body size.

### 4B — `cors`: validate preflights, reject wildcard+credentials (finding 9)

**Files:** `src/middleware/cors.ts:33-75`

- In the `before` hook, require `Access-Control-Request-Method` header for preflight recognition. Without it, treat as a normal OPTIONS request (fall through).
- If `credentials: true` and `origin` is `"*"`, throw at construction time (invalid combination per spec).
- In `after`, use `response.headers.append("Vary", "Origin")` (already done) — but also ensure `cache.ts` appends rather than replaces `Vary`.

### 4C — `cache`: merge Vary tokens (finding 9)

**Files:** `src/middleware/cache.ts:28-34`

- Change `response.headers.set(HTTP.header.Vary, value)` to `response.headers.append(HTTP.header.Vary, value)`.

### 4D — `www` / `https`: clone URL, fix double-prefix (finding 10)

**Files:** `src/middleware/www.ts:4-13`, `src/middleware/https.ts:4-10`

- Clone `url` before transforming: `const target = new URL(url.href)`.
- In `www()`, separate the hostname and protocol checks. Only prepend `www.` if `!isWww`. Only upgrade protocol if `secure && !isSecure`. Redirect only if `target.href !== url.href`.
- In `https()`, same clone pattern.

### 4E — `csp`: single source of directive keys, snapshot options (finding 12)

**Files:** `src/middleware/csp.ts:9-46`

- Define directive keys as a single `as const` tuple. Derive both `CspOptions` fields and `directiveMap` entries from it.
- Snapshot (shallow-copy) each source array at construction so later caller mutation cannot produce `'nonce-undefined'`.

### 4F — `rateLimit`: validate options, document fixed-window (finding 16)

**Files:** `src/middleware/rateLimit.ts:24-29`

- At construction, assert `window > 0 && Number.isFinite(window)` and `max >= 0 && Number.isFinite(max)`. Throw on violation.
- Update JSDoc to say "fixed-window" (not sliding-window).

### 4G — `prefix`: accept exact root (finding 18)

**Files:** `src/handler/prefix.ts:26-33`

- Change the guard from `startsWith(root)` only, to also accept `pathname === prefix` (the non-slash version). When matched exactly, set child pathname to `"/"`.

---

## Phase 5: Asset pathname contract

**Findings:** 14

### 5B — Normalize asset pathname contract (finding 14)

**Files:** `src/Assets.ts`, `src/bun/bun.ts:17-40`, `src/cloudflare/cloudflare.ts:31-42`, `src/handler/assets.ts:5-11`

- Document and enforce that `Assets.static()` receives an absolute pathname (leading `/`).
- In `assets()` handler, remove the redundant 404 status check — adapters are solely responsible for returning `undefined` for missing files.

---

## Sequencing and risk

| Phase | Depends on | Risk | Estimated scope |
|-------|-----------|------|-----------------|
| 1 | — | High — changes core dispatch semantics | `Router.ts`, `use.ts` |
| 2 | 1 | High — changes binding model | `Router.ts`, `cookies.ts`, `rateLimit.ts`, `prefix.ts`, `pattern.ts` |
| 3 | 1 | Medium — changes match/error flow | `pattern.ts`, `Router.ts`, `RouterError.ts` |
| 4 | 1, 2 | Low per item — isolated middleware fixes | Individual middleware files |
| 5 | 1, 2 | Low — narrow contract clarification | `Assets.ts`, adapters, `assets.ts` |

Phase 1 is the critical path. It should be developed on a branch with manual smoke tests against both Bun and Cloudflare adapters before merging. Phases 2-5 can be individual commits/PRs.
