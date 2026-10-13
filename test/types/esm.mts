// ESM consumer fixture: compiled against the installed tarball with module=nodenext.
import {
  AbortedError,
  isPackageError,
  type RetryOptions,
  RetryExhaustedError,
  withRetry,
} from "npm-package-boilerplate";

const options: RetryOptions = { retries: 1, minDelayMs: 1, jitter: false };

const value: Promise<number> = withRetry(async (attempt) => attempt, options);
const text: Promise<string> = withRetry(() => "sync", options);

declare const error: unknown;
if (error instanceof RetryExhaustedError) {
  const attempts: number = error.attempts;
  void attempts;
}
if (isPackageError(error)) {
  const code: "ERR_INVALID_OPTION" | "ERR_RETRY_EXHAUSTED" | "ERR_ABORTED" = error.code;
  void code;
}
void AbortedError;
void value;
void text;
