import type { Assets } from "../Assets"
import type { RequestHandler } from "../router.types"

/** Serves static files via the platform's Assets binding. */
export function assets(): RequestHandler {
  return ({ assets, request }: { assets: Assets; request: Request }) =>
    assets.file(request)
}
