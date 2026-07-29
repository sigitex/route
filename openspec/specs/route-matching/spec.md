# route-matching

## Purpose

Method/path matching: 405 fallthrough with aggregated `Allow` header, and prefix root matching.

## Requirements

### Requirement: Method mismatch falls through
`pattern()` SHALL return `undefined` (fallthrough) when the pathname matches but the method does not, recording the candidate's method in a per-request collector instead of short-circuiting with a 405 response.

#### Scenario: Later route with same path, different method
- **WHEN** routes `get("/x", a)` then `post("/x", b)` are registered and a POST `/x` request arrives
- **THEN** handler `b` handles the request

### Requirement: Aggregated 405 with Allow header
After all candidates miss, the router SHALL return `405` with an `Allow` header listing every method recorded by pathname-matched candidates. If no candidate matched the pathname, the router SHALL return `404`.

#### Scenario: Path matched, wrong method everywhere
- **WHEN** only `get("/x", a)` and `put("/x", b)` are registered and a POST `/x` request arrives
- **THEN** the response is 405 with `Allow: GET, PUT`

#### Scenario: No path match
- **WHEN** no registered pattern matches the request pathname
- **THEN** the response is 404 without an `Allow` header

### Requirement: Prefix matches its exact root
`prefix(p, …)` SHALL match requests whose pathname equals `p` exactly (without trailing slash) in addition to pathnames starting with `p + "/"`. On an exact match the child pathname SHALL be `"/"`.

#### Scenario: Exact root request
- **WHEN** `prefix("/api", get("/", h))` is registered and a GET `/api` request arrives
- **THEN** `h` handles the request with child pathname `"/"`

#### Scenario: Non-prefix lookalike
- **WHEN** the same prefix is registered and a GET `/apiary` request arrives
- **THEN** the prefix does not match
