# asset-serving

## ADDED Requirements

### Requirement: Assets.static takes an absolute pathname
`Assets.static(path)` SHALL accept an absolute pathname beginning with `/`. The contract SHALL be documented on the `Assets` type, and adapters SHALL enforce it (normalize or reject paths lacking a leading `/`).

#### Scenario: Absolute pathname
- **WHEN** `assets.static("/logo.svg")` is called on either adapter
- **THEN** the file at that pathname under the asset root is served

#### Scenario: Relative pathname
- **WHEN** `assets.static("logo.svg")` is called
- **THEN** the adapter enforces the contract (normalizes to `/logo.svg` or rejects) rather than resolving ambiguously

### Requirement: Adapters alone signal missing files
`Assets.file(request)` SHALL return `undefined` for a missing file. The `assets()` handler SHALL fall through only on `undefined` and SHALL NOT inspect `response.status` for 404.

#### Scenario: Missing file falls through
- **WHEN** `assets.file()` returns `undefined`
- **THEN** the `assets()` handler returns `undefined` and routing continues

#### Scenario: Adapter-served 404 page
- **WHEN** an adapter intentionally returns a `Response` with status 404 (e.g. a custom static 404 page)
- **THEN** the `assets()` handler returns that response unmodified
