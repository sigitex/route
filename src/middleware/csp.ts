import { CSP, type CspSource } from "../CSP"
import { HTTP } from "../HTTP"
import type {
  RequestContext,
  ResponseContext,
  RouteMiddleware,
} from "../router.types"

const directiveKeys = [
  "defaultSrc",
  "scriptSrc",
  "styleSrc",
  "imgSrc",
  "connectSrc",
  "fontSrc",
  "frameSrc",
  "frameAncestors",
  "mediaSrc",
  "objectSrc",
  "workerSrc",
  "childSrc",
  "baseUri",
  "formAction",
  "manifestSrc",
] as const

type DirectiveKey = (typeof directiveKeys)[number]

export type CspOptions = {
  readonly [Key in DirectiveKey]?: CspSource[]
} & {
  readonly upgradeInsecureRequests?: boolean
  readonly reportOnly?: boolean
  readonly reportTo?: string
}

type Directive = { readonly name: string; readonly sources: CspSource[] }

/** Sets Content-Security-Policy headers with optional automatic nonce generation. */
export function csp(options: CspOptions): RouteMiddleware {
  const directives: Directive[] = []
  for (const key of directiveKeys) {
    const sources = options[key]
    if (sources && sources.length > 0) {
      directives.push({ name: directiveName(key), sources: [...sources] })
    }
  }
  const usesNonce = directives.some(({ sources }) =>
    sources.includes(CSP.nonce),
  )
  const upgradeInsecureRequests = options.upgradeInsecureRequests ?? false
  const reportTo = options.reportTo
  const header = options.reportOnly
    ? HTTP.header.ContentSecurityPolicyReportOnly
    : HTTP.header.ContentSecurityPolicy

  return {
    before: usesNonce
      ? ({ bind }: RequestContext) => {
          bind({ cspNonce: crypto.randomUUID() })
        }
      : undefined,
    after: ({
      response,
      cspNonce,
    }: ResponseContext & { cspNonce?: string }) => {
      const value = buildPolicy(
        directives,
        upgradeInsecureRequests,
        reportTo,
        cspNonce,
      )
      response.headers.set(header, value)
    },
  }
}

function directiveName(key: DirectiveKey): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function buildPolicy(
  directives: Directive[],
  upgradeInsecureRequests: boolean,
  reportTo: string | undefined,
  nonce: string | undefined,
): string {
  const parts: string[] = []

  for (const { name, sources } of directives) {
    const resolved = sources.map((source) =>
      source === CSP.nonce ? `'nonce-${nonce}'` : (source as string),
    )
    parts.push(`${name} ${resolved.join(" ")}`)
  }

  if (upgradeInsecureRequests) {
    parts.push("upgrade-insecure-requests")
  }

  if (reportTo) {
    parts.push(`report-to ${reportTo}`)
  }

  return parts.join("; ")
}
