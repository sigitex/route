import type { RequestHandler } from "../router.types"

/** A handler that does nothing; used internally by middleware composition. */
export const noop: RequestHandler = () => {}
