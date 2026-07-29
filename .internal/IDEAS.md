# Ideas

## Explicit Runtimes

Change `bun()` and `cloudflare()` from middleware and pass replacements to `RouterOptions`.

```ts
export default {
  fetch: route(
    container,
    middlewares: [cookies()],
    platform: bun(),
  )
}
```

Also make running without a platform possible with a default no-op assets system.
