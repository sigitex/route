// oxlint-disable unicorn/custom-error-definition
export class RouterError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = "RouterError"
  }
}

export class NotFound extends RouterError {
  constructor(message?: string) {
    super(404, message ?? "Not found.")
    this.name = "NotFound"
  }
}

export class ServerError extends Error {
  constructor(message?: string) {
    super(message ?? "Internal error.")
    this.name = "ServerError"
  }
}

export class MethodNotAllowed extends RouterError {
  constructor(message?: string) {
    super(405, message ?? "Method not allowed.")
    this.name = "MethodNotAllowed"
  }
}

export class InvalidRequest extends RouterError {
  constructor(message?: string) {
    super(400, message ?? "Invalid request.")
    this.name = "InvalidRequest"
  }
}