/**
 * @typedef {object} RetryInfo
 * @property {number} attempt 1-based number of the attempt that just failed.
 * @property {number} delayMs Delay in milliseconds before the next attempt.
 * @property {unknown} error
 */

/**
 * @typedef {object} RetryOptions
 * @property {number} [retries] Retries after the first attempt. Default 3.
 * @property {number} [minDelayMs] Delay before the first retry. Default 100.
 * @property {number} [maxDelayMs] Upper bound for any single delay. Default 5000.
 * @property {number} [factor] Exponential growth factor. Default 2.
 * @property {boolean} [jitter] Apply full jitter to each delay. Default true.
 * @property {AbortSignal} [signal] Cancels waiting and prevents further attempts.
 * @property {(error: unknown, attempt: number) => boolean} [shouldRetry] Return false to rethrow the original error immediately. Default retries everything.
 * @property {(info: RetryInfo) => void} [onRetry] Logging hook invoked before each wait. Exceptions thrown here are ignored.
 */

export {};
