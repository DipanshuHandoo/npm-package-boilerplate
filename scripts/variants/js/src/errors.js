/** @typedef {"ERR_INVALID_OPTION" | "ERR_RETRY_EXHAUSTED" | "ERR_ABORTED"} ErrorCode */

export class PackageError extends Error {
  /** @type {ErrorCode} */
  code;

  /**
   * @param {ErrorCode} code
   * @param {string} message
   * @param {ErrorOptions} [options]
   */
  constructor(code, message, options) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidOptionError extends PackageError {
  /** @param {string} message */
  constructor(message) {
    super("ERR_INVALID_OPTION", message);
  }
}

export class RetryExhaustedError extends PackageError {
  /** @type {number} */
  attempts;

  /**
   * @param {number} attempts
   * @param {unknown} cause
   */
  constructor(attempts, cause) {
    super("ERR_RETRY_EXHAUSTED", `Operation failed after ${attempts} attempt(s)`, { cause });
    this.attempts = attempts;
  }
}

export class AbortedError extends PackageError {
  /** @param {unknown} [cause] */
  constructor(cause) {
    super("ERR_ABORTED", "Operation was aborted", { cause });
  }
}

/**
 * @param {unknown} value
 * @returns {value is PackageError}
 */
export function isPackageError(value) {
  return value instanceof PackageError;
}
