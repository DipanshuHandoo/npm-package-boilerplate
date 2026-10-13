import assert from "node:assert/strict";
import {
  AbortedError,
  InvalidOptionError,
  isPackageError,
  RetryExhaustedError,
  withRetry,
} from "npm-package-boilerplate";

console.log("1. Success after transient failures, with a logging hook");
const retries = [];
let calls = 0;
const value = await withRetry(
  () => {
    if (++calls < 3) throw new Error(`flaky #${calls}`);
    return calls;
  },
  {
    minDelayMs: 1,
    maxDelayMs: 4,
    onRetry: ({ attempt, delayMs }) => retries.push([attempt, delayMs]),
  },
);
assert.equal(value, 3);
assert.equal(retries.length, 2);

console.log("2. Exhaustion exposes attempts and the last error as the cause");
await assert.rejects(
  withRetry(
    () => {
      throw new Error("always");
    },
    { retries: 2, minDelayMs: 1, maxDelayMs: 2 },
  ),
  (error) => {
    assert.ok(error instanceof RetryExhaustedError);
    assert.equal(error.attempts, 3);
    assert.equal(error.cause.message, "always");
    return true;
  },
);

console.log("3. Non-retryable errors are rethrown unchanged");
const fatal = new Error("bad request");
await assert.rejects(
  withRetry(
    () => {
      throw fatal;
    },
    { shouldRetry: () => false },
  ),
  (error) => error === fatal,
);

console.log("4. Cancellation during backoff");
const controller = new AbortController();
const pending = withRetry(
  () => {
    throw new Error("slow failure");
  },
  { minDelayMs: 60_000, maxDelayMs: 60_000, jitter: false, signal: controller.signal },
);
setTimeout(() => controller.abort(), 10);
await assert.rejects(pending, AbortedError);

console.log("5. Invalid options fail fast with a typed error");
await assert.rejects(
  withRetry(() => 1, { retries: -1 }),
  (error) => {
    assert.ok(error instanceof InvalidOptionError);
    assert.ok(isPackageError(error));
    assert.equal(error.code, "ERR_INVALID_OPTION");
    return true;
  },
);

console.log("Full tour complete");
