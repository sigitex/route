import Path from "node:path"
import { Assets } from "../Assets"
import type { RequestHandler } from "../router.types"

type BunOptions = {
  readonly assets?: string
}

/** Bun runtime adapter; binds a local-filesystem Assets implementation. */
export function bun(options: BunOptions = {}): RequestHandler {
  const assets = bunAssets(options.assets ?? "./assets")
  return ({ bind }: { bind: (bindings: { assets: Assets }) => void }) => {
    bind({ assets })
  }
}

function bunAssets(dir: string): Assets {
  const cache = new Map<string, Response>()

  return {
    async static(path, options) {
      const pathname = Assets.pathname(path)
      const key = options?.root ? `root:${pathname}` : pathname
      const cached = cache.get(key)
      if (cached) {
        return cached.clone() as Response
      }
      const file = Bun.file(Path.join(options?.root ? "." : dir, pathname))
      const response = new Response(await file.bytes(), {
        headers: { "Content-Type": file.type },
      })
      cache.set(key, response.clone() as Response)
      return response as Response
    },
    async file(request, options) {
      const path = new URL(request.url).pathname
      const file = Bun.file(Path.join(options?.root ? "." : dir, path))
      if (!(await file.exists())) {
        return undefined
      }
      return new Response(file) as Response
    },
  }
}
