# asset-serving

## Purpose

The pathname contract between `Assets` adapters and the `assets()` handler.

## Requirements

### Requirement: Assets.static takes an absolute pathname
`Assets.static(path)` SHALL accept an absolute pathname beginning with `/`. The contract SHALL be documented on the `Assets` type, and adapters SHALL enforce it (normalize or reject paths lacking a leading `/`).

#### Scenario: Absolute pathname
- **WHEN** `assets.static("/logo.svg")` is called on either adapter
- **THEN** the file at that pathname under the asset root is served

#### Scenario: Relative pathname
- **WHEN** `assets.static("logo.svg")` is called
- **THEN** the adapter enforces the contract (normalizes to `/logo.svg` or rejects) rather than resolving ambiguously

### Requirement: Root bypass resolves against the app root
`Assets.static(path, options)` and `Assets.file(request, options)` SHALL accept an optional `{ root: true }` that resolves the pathname against the platform app root instead of the configured asset root. On platforms where the two coincide (the Cloudflare Workers assets binding is the only file source), the option SHALL be a no-op. The `app()` handler SHALL serve its index document (default `"/index.html"`, overridable via its second parameter) with `{ root: true }`.

#### Scenario: App-root file on Bun
- **WHEN** `assets.static("/index.html", { root: true })` is called on the Bun adapter configured with asset root `"./assets"`
- **THEN** the file is served from `<cwd>/index.html`, not `<cwd>/assets/index.html`

#### Scenario: No-op on Cloudflare
- **WHEN** the same call is made on the Cloudflare adapter
- **THEN** the response is identical to `assets.static("/index.html")`

### Requirement: Adapters alone signal missing files
`Assets.file(request)` SHALL return `undefined` for a missing file. The `assets()` handler SHALL fall through only on `undefined` and SHALL NOT inspect `response.status` for 404.

#### Scenario: Missing file falls through
- **WHEN** `assets.file()` returns `undefined`
- **THEN** the `assets()` handler returns `undefined` and routing continues

#### Scenario: Adapter-served 404 page
- **WHEN** an adapter intentionally returns a `Response` with status 404 (e.g. a custom static 404 page)
- **THEN** the `assets()` handler returns that response unmodified
