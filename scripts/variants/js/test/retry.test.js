import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AbortedError,
  computeDelay,
  InvalidOptionError,
  isPackageError,
  RetryExhaustedError,
  withRetry,
} from "../src/index.js";
import { failTimes } from "./helpers.js";

const fast = { minDelayMs: 1, maxDelayMs: 2, jitter: false };

describe("withRetry", () => {
  it("returns the first successful result without retrying", async () => {
    const { fn, calls } = failTimes(0, "ok");
    assert.equal(await withRetry(fn, fast), "ok");
    assert.equal(calls(), 1);
  });

  it("retries transient failures and reports each retry", async () => {
    const { fn, calls } = failTimes(2, "ok");
    /** @type {number[]} */
    const seen = [];
    assert.equal(
      await withRetry(fn, { ...fast, onRetry: (info) => seen.push(info.attempt) }),
      "ok",
    );
    assert.equal(calls(), 3);
    assert.deepEqual(seen, [1, 2]);
  });

  it("throws RetryExhaustedError with the last error as cause", async () => {
    const { fn, calls } = failTimes(10, "never");
    await assert.rejects(
      withRetry(fn, { ...fast, retries: 2 }),
      /** @param {any} error */
      (error) => {
        assert.ok(error instanceof RetryExhaustedError);
        assert.equal(error.attempts, 3);
        assert.equal(error.code, "ERR_RETRY_EXHAUSTED");
        assert.match(/** @type {Error} */ (error.cause).message, /boom #3/);
        assert.ok(isPackageError(error));
        return true;
      },
    );
    assert.equal(calls(), 3);
  });

  it("does not retry when retries is 0", async () => {
    const { fn, calls } = failTimes(1, "x");
    await assert.rejects(withRetry(fn, { retries: 0 }), RetryExhaustedError);
    assert.equal(calls(), 1);
  });

  it("rethrows the original error when shouldRetry returns false", async () => {
    const original = new Error("fatal");
    await assert.rejects(
      withRetry(
        async () => {
          throw original;
        },
        { ...fast, shouldRetry: () => false },
      ),
      (error) => error === original,
    );
  });

  it("ignores exceptions thrown by onRetry", async () => {
    const { fn } = failTimes(1, "ok");
    const result = await withRetry(fn, {
      ...fast,
      onRetry: () => {
        throw new Error("logger down");
      },
    });
    assert.equal(result, "ok");
  });

  it("passes the 1-based attempt number to fn", async () => {
    /** @type {number[]} */
    const attempts = [];
    await withRetry((attempt) => {
      attempts.push(attempt);
      if (attempt < 3) throw new Error("again");
      return attempt;
    }, fast);
    assert.deepEqual(attempts, [1, 2, 3]);
  });

  it("rejects before running when the signal is already aborted", async () => {
    const { fn, calls } = failTimes(0, "ok");
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(withRetry(fn, { signal: controller.signal }), AbortedError);
    assert.equal(calls(), 0);
  });

  it("aborts during backoff and stops further attempts", async () => {
    const { fn, calls } = failTimes(10, "never");
    const controller = new AbortController();
    const promise = withRetry(fn, {
      minDelayMs: 10_000,
      maxDelayMs: 10_000,
      jitter: false,
      signal: controller.signal,
      onRetry: () => controller.abort(new Error("stop")),
    });
    await assert.rejects(
      promise,
      /** @param {any} error */
      (error) => {
        assert.ok(error instanceof AbortedError);
        assert.match(/** @type {Error} */ (error.cause).message, /stop/);
        return true;
      },
    );
    assert.equal(calls(), 1);
  });

  it("aborts mid-wait when the signal fires after the wait began", async () => {
    const { fn } = failTimes(10, "never");
    const controller = new AbortController();
    const promise = withRetry(fn, {
      minDelayMs: 10_000,
      maxDelayMs: 10_000,
      jitter: false,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(promise, AbortedError);
  });

  it("converts failures into AbortedError when aborted during fn", async () => {
    const controller = new AbortController();
    await assert.rejects(
      withRetry(
        async () => {
          controller.abort();
          throw new Error("late failure");
        },
        { signal: controller.signal },
      ),
      AbortedError,
    );
  });

  it("propagates an AbortedError thrown by fn without retrying", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(async () => {
        calls++;
        throw new AbortedError();
      }, fast),
      AbortedError,
    );
    assert.equal(calls, 1);
  });

  it("keeps no state between calls", async () => {
    const first = failTimes(1, "a");
    const second = failTimes(1, "b");
    assert.deepEqual(await Promise.all([withRetry(first.fn, fast), withRetry(second.fn, fast)]), [
      "a",
      "b",
    ]);
  });

  it("validates options", async () => {
    const noop = async () => 1;
    const invalid = [
      { retries: -1 },
      { retries: 1.5 },
      { minDelayMs: -5 },
      { maxDelayMs: Number.NaN },
      { factor: 0.5 },
    ];
    for (const bad of invalid) {
      await assert.rejects(withRetry(noop, bad), InvalidOptionError);
    }
  });
});

describe("computeDelay", () => {
  const base = { minDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: false };

  it("grows exponentially and is capped", () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((i) => computeDelay(i, base)),
      [100, 200, 400, 800, 1000],
    );
  });

  it("applies full jitter within the computed bound", () => {
    assert.equal(
      computeDelay(1, { ...base, jitter: true }, () => 0.5),
      100,
    );
    assert.equal(
      computeDelay(1, { ...base, jitter: true }, () => 0),
      0,
    );
  });
});
