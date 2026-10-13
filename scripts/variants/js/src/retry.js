import { AbortedError, InvalidOptionError, RetryExhaustedError } from "./errors.js";

/** @typedef {import("./types.js").RetryOptions} RetryOptions */

const DEFAULTS = { retries: 3, minDelayMs: 100, maxDelayMs: 5000, factor: 2, jitter: true };

/**
 * @param {string} name
 * @param {number} value
 */
function assertNonNegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidOptionError(`${name} must be a non-negative integer, received ${value}`);
  }
}

/**
 * @param {number} retryIndex
 * @param {{ minDelayMs: number, maxDelayMs: number, factor: number, jitter: boolean }} options
 * @param {() => number} [random]
 */
export function computeDelay(retryIndex, options, random = Math.random) {
  const exponential = Math.min(
    options.maxDelayMs,
    options.minDelayMs * options.factor ** retryIndex,
  );
  return options.jitter ? Math.floor(random() * exponential) : exponential;
}

/**
 * @param {number} ms
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortedError(signal.reason));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError(signal?.reason));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs `fn` until it succeeds or the retry budget is spent, using exponential backoff.
 * Only use with operations that are safe to repeat (idempotent).
 * @template T
 * @param {(attempt: number) => Promise<T> | T} fn
 * @param {RetryOptions} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, options = {}) {
  const retries = options.retries ?? DEFAULTS.retries;
  const minDelayMs = options.minDelayMs ?? DEFAULTS.minDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const factor = options.factor ?? DEFAULTS.factor;
  const jitter = options.jitter ?? DEFAULTS.jitter;
  const { signal, shouldRetry, onRetry } = options;

  assertNonNegativeInteger("retries", retries);
  assertNonNegativeInteger("minDelayMs", minDelayMs);
  assertNonNegativeInteger("maxDelayMs", maxDelayMs);
  if (!(factor >= 1)) {
    throw new InvalidOptionError(`factor must be >= 1, received ${factor}`);
  }

  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw new AbortedError(signal.reason);

    try {
      return await fn(attempt);
    } catch (error) {
      if (error instanceof AbortedError) throw error;
      if (signal?.aborted) throw new AbortedError(signal.reason);

      if (shouldRetry && !shouldRetry(error, attempt)) throw error;
      if (attempt > retries) throw new RetryExhaustedError(attempt, error);

      const delayMs = computeDelay(attempt - 1, { minDelayMs, maxDelayMs, factor, jitter });
      try {
        onRetry?.({ attempt, delayMs, error });
      } catch {
        // A faulty logging hook must never change retry behaviour.
      }
      await sleep(delayMs, signal);
    }
  }
}
