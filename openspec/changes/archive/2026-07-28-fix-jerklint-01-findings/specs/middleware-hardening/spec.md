# middleware-hardening

## ADDED Requirements

### Requirement: bodyLimit validates Content-Length and matches media types exactly
`bodyLimit` SHALL parse `Content-Length` with `Number.parseInt`, treat non-finite or negative values as invalid (reject the request), and compare content types by exact media type — the `Content-Type` value truncated at `;`, trimmed, lowercased — not by prefix. Its JSDoc SHALL state it enforces the `Content-Length` header only, not streamed body size.

#### Scenario: Malformed Content-Length
- **WHEN** a request carries `Content-Length: abc`
- **THEN** the request is rejected rather than passed through

#### Scenario: Media type with parameters
- **WHEN** `contentTypes: ["application/json"]` is configured and a request carries `Content-Type: application/json; charset=utf-8`
- **THEN** the request is allowed

#### Scenario: Prefix lookalike media type
- **WHEN** `contentTypes: ["application/json"]` is configured and a request carries `Content-Type: application/json-patch+json`
- **THEN** the request is rejected with 415

### Requirement: cors validates preflights and rejects wildcard credentials
`cors` SHALL treat an OPTIONS request as a preflight only when it carries an `Access-Control-Request-Method` header; otherwise the OPTIONS request falls through to handlers. `cors({ origin: "*", credentials: true })` SHALL throw at construction time.

#### Scenario: Plain OPTIONS request
- **WHEN** an OPTIONS request has an `Origin` header but no `Access-Control-Request-Method`
- **THEN** the middleware does not short-circuit and handlers may respond

#### Scenario: Wildcard with credentials
- **WHEN** `cors({ origin: "*", credentials: true })` is constructed
- **THEN** an error is thrown before any request is served

### Requirement: cache appends Vary tokens
`cache` SHALL append its `vary` value to the `Vary` header rather than replacing existing tokens.

#### Scenario: Vary set by earlier middleware
- **WHEN** `cors` has already appended `Vary: Origin` and `cache({ vary: "Accept" })` runs
- **THEN** the response `Vary` header contains both `Origin` and `Accept`

### Requirement: Redirect middleware does not mutate the request URL
`www()` and `https()` SHALL build their redirect target from a clone of `context.url`, never mutating the original. `www()` SHALL apply the `www.` prefix only when the hostname lacks it, upgrade the protocol only when `secure` is set and the request is not already HTTPS, and redirect only when the target differs from the request URL.

#### Scenario: www redirect leaves context url intact
- **WHEN** `www()` issues a redirect for `http://example.com/a`
- **THEN** `context.url.hostname` remains `example.com` for any later handler in the same request

#### Scenario: Already-www insecure request with secure option
- **WHEN** `www({ secure: true })` receives `http://www.example.com/a`
- **THEN** the redirect target is `https://www.example.com/a` — protocol upgraded without double-prefixing `www.`

### Requirement: csp derives directives from one key tuple and snapshots sources
`csp` SHALL define its directive keys as a single `as const` tuple from which both the `CspOptions` fields and the directive-name map derive, and SHALL shallow-copy each source array at construction.

#### Scenario: Source array mutated after construction
- **WHEN** a caller appends `CSP.nonce` to a source array after `csp()` was constructed without nonce usage
- **THEN** emitted policies never contain `'nonce-undefined'`

### Requirement: rateLimit validates options and documents fixed windows
`rateLimit` SHALL throw at construction when `window` is not a finite number > 0 or `max` is not a finite number >= 0. Its JSDoc SHALL describe the algorithm as fixed-window.

#### Scenario: Invalid window
- **WHEN** `rateLimit({ window: 0 })` is constructed
- **THEN** an error is thrown
