const nonce = Symbol("csp-nonce")

/** Content-Security-Policy source value constants. */
export const CSP = {
  self: "'self'",
  none: "'none'",
  unsafeInline: "'unsafe-inline'",
  unsafeEval: "'unsafe-eval'",
  unsafeHashes: "'unsafe-hashes'",
  strictDynamic: "'strict-dynamic'",
  nonce,
  wildcard: "*",
  data: "data:",
  blob: "blob:",
  https: "https:",
  wss: "wss:",
} as const

/** A CSP source value: a string directive or the nonce symbol. */
export type CspSource = string | typeof nonce
