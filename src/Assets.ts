/** Options for `Assets.static()` and `Assets.file()`. */
export type AssetsOptions = {
  /**
   * Resolve the pathname against the app root instead of the configured
   * asset root. On platforms where the two coincide (Cloudflare Workers
   * assets binding) this is a no-op.
   */
  readonly root?: boolean
}

/** Platform-agnostic interface for serving static files. */
export type Assets = {
  /**
   * Serves the asset at an absolute pathname under the asset root, e.g.
   * `"/index.html"`. Adapters normalize paths lacking the leading `/`.
   * Pass `{ root: true }` to resolve against the app root instead.
   */
  static(path: string, options?: AssetsOptions): Promise<Response>
  /**
   * Serves the asset matching the request URL, or undefined when missing.
   * Pass `{ root: true }` to resolve against the app root instead.
   */
  file(request: Request, options?: AssetsOptions): Promise<Response | undefined>
}

export namespace Assets {
  /** Normalizes a `static()` path to the absolute-pathname contract. */
  export function pathname(path: string): string {
    return path.startsWith("/") ? path : `/${path}`
  }
}
