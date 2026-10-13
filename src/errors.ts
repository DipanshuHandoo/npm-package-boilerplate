export type ErrorCode = "ERR_INVALID_OPTION" | "ERR_RETRY_EXHAUSTED" | "ERR_ABORTED";

export class PackageError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidOptionError extends PackageError {
  constructor(message: string) {
    super("ERR_INVALID_OPTION", message);
  }
}

export class RetryExhaustedError extends PackageError {
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super("ERR_RETRY_EXHAUSTED", `Operation failed after ${attempts} attempt(s)`, { cause });
    this.attempts = attempts;
  }
}

export class AbortedError extends PackageError {
  constructor(cause?: unknown) {
    super("ERR_ABORTED", "Operation was aborted", { cause });
  }
}

export function isPackageError(value: unknown): value is PackageError {
  return value instanceof PackageError;
}
