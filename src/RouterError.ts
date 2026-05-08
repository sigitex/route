// oxlint-disable unicorn/custom-error-definition
/** Base error class with an HTTP status code. */
export class RouterError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = "RouterError"
  }
}

/** 404 Not Found error. */
export class NotFound extends RouterError {
  constructor(message?: string) {
    super(404, message ?? "Not found.")
    this.name = "NotFound"
  }
}

/** Generic server error (no HTTP status code). */
export class ServerError extends Error {
  constructor(message?: string) {
    super(message ?? "Internal error.")
    this.name = "ServerError"
  }
}

/** 405 Method Not Allowed error. */
export class MethodNotAllowed extends RouterError {
  constructor(message?: string) {
    super(405, message ?? "Method not allowed.")
    this.name = "MethodNotAllowed"
  }
}

/** 400 Invalid Request error. */
export class InvalidRequest extends RouterError {
  constructor(message?: string) {
    super(400, message ?? "Invalid request.")
    this.name = "InvalidRequest"
  }
}