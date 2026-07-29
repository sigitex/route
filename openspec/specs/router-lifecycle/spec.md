# router-lifecycle

## Purpose

Request dispatch order: global middleware phases, after-hook unwind order, response finalization, and error boundary behavior.

## Requirements

### Requirement: Global middleware runs once per request
The router SHALL execute `RouterOptions.middlewares` exactly once per request, wrapping the entire candidate-handler loop — not once per candidate handler.

#### Scenario: Multiple non-matching candidates
- **WHEN** a request is routed through a router with 3 handlers where only the third matches, and a global middleware with a `before` hook is configured
- **THEN** the `before` hook executes exactly once for the request

#### Scenario: Before short-circuit
- **WHEN** a global `before` hook returns a value
- **THEN** no candidate handler is invoked and the returned value is finalized as the response, passing through the after-hooks of middleware that already ran

### Requirement: After-hooks unwind in reverse registration order
The dispatch engine SHALL run `after` hooks in reverse registration order (last registered runs first), mirroring onion semantics.

#### Scenario: Two after-hooks
- **WHEN** middlewares A then B are registered and both have `after` hooks that append to a shared header
- **THEN** B's `after` hook runs before A's

### Requirement: The decorated response is the returned response
The dispatch engine SHALL call `respond(result)` exactly once, bind the resulting `Response`, run after-hooks against it, and return that same instance (or an after-hook's replacement). Header mutations made by after-hooks MUST be present on the response the client receives.

#### Scenario: Plain-object handler result with header-mutating after-hook
- **WHEN** a handler returns a plain object and an `after` hook sets a header on `context.response`
- **THEN** the client response contains that header

#### Scenario: After-hook replaces response
- **WHEN** an `after` hook returns a new `Response`
- **THEN** that `Response` becomes the final response, and remaining (earlier-registered) after-hooks run against it

### Requirement: bind is synchronous
`bind()` SHALL be a synchronous function returning `void`; the `RouterBind` type SHALL NOT wrap its return in a `Promise`.

#### Scenario: Bind inside handler
- **WHEN** a handler calls `bind({ value })` and reads `context.value` on the next line
- **THEN** the binding is visible immediately without awaiting

### Requirement: use() delegates to dispatch
`use()` SHALL implement its middleware phases by delegating to `context.dispatch()` with its middleware list, not by re-casting `after` hooks as `before` hooks around a noop handler.

#### Scenario: Group with after-hook, no match
- **WHEN** no handler inside `use()` produces a result
- **THEN** `use()` returns `undefined` and none of its middleware `after` hooks run

### Requirement: Error boundary honors RouterError status
`Router.route()` SHALL catch thrown `RouterError` instances and respond with the error's `status` and message. Non-`RouterError` exceptions SHALL produce a 500 and be logged; `RouterError`s SHALL NOT be logged. `RouterError` SHALL expose the HTTP status as `status` (renamed from `code`).

#### Scenario: Handler throws NotFound
- **WHEN** a handler throws `new NotFound("gone")`
- **THEN** the response has status 404 with message "gone" and nothing is written to `console.error`

#### Scenario: Handler throws TypeError
- **WHEN** a handler throws a `TypeError`
- **THEN** the response has status 500 and the error is logged via `console.error`
