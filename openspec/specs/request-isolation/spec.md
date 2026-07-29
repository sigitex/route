# request-isolation

## Purpose

Request-scoped state: scoped `bind()` overlays for nested dispatch, per-request middleware state, and snapshots of constructor/factory inputs.

## Requirements

### Requirement: Bindings are scoped to their dispatch
`bind()` SHALL write into a scope created by the current `dispatch()` call. Bindings SHALL be visible to the bound scope and its children, and SHALL unwind (become invisible to the parent) when that dispatch returns.

#### Scenario: Prefix fallthrough restores url
- **WHEN** a `prefix("/api", …)` handler matches the path, binds a stripped `url`, and none of its children produce a result
- **THEN** the next sibling candidate observes the original request `url`, not the stripped one

#### Scenario: Pattern params do not leak to siblings
- **WHEN** a `pattern()` candidate binds `params` and its inner handler returns `undefined`
- **THEN** subsequent candidates do not observe those `params`

### Requirement: Middleware factories hold no per-request state
Middleware factories (`cookies()`, `rateLimit()`) SHALL create per-request state inside their `before` hooks and convey it to `after` hooks via request-scoped bindings or per-request closures. Factory closures SHALL retain only process-wide immutable configuration.

#### Scenario: Concurrent requests with cookies middleware
- **WHEN** two requests are in flight concurrently through one `cookies()` instance and each sets a different cookie
- **THEN** each response carries only its own `Set-Cookie` headers

#### Scenario: Concurrent requests with rateLimit headers
- **WHEN** two requests from different IPs pass through one `rateLimit()` instance concurrently
- **THEN** each response's `X-RateLimit-Remaining` reflects that request's own counter, never the other request's

### Requirement: Constructor and factory inputs are snapshotted
The `Router` constructor SHALL shallow-copy the `handlers` and `middlewares` arrays. Middleware factories SHALL snapshot phase-sensitive option arrays (e.g. `bodyLimit.contentTypes`, CORS origin/method/header lists, CSP source arrays) at construction.

#### Scenario: Caller mutates handler array after construction
- **WHEN** a caller pushes a new handler into the array passed to `new Router(handlers)` after construction
- **THEN** routing behavior is unchanged

#### Scenario: Caller mutates CSP source array after construction
- **WHEN** a caller mutates a source array passed to `csp()` after construction
- **THEN** emitted `Content-Security-Policy` headers are built from the values present at construction
