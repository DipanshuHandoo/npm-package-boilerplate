# Retry guide

`withRetry` re-runs an async (or sync) function with exponential backoff and full jitter.

## Only retry what is safe

Retrying repeats side effects. Use it for idempotent operations, and restrict retries to
transient failures with `shouldRetry`:

```js
await withRetry(() => fetchJson(url), {
  shouldRetry: (error) => error.status === 429 || error.status >= 500,
});
```

## Delays

Delay before retry `n` (0-based) is `min(maxDelayMs, minDelayMs * factor^n)`; with `jitter` the
actual wait is uniformly random in `[0, delay]`. Jitter prevents synchronized retry storms across
many workers; disable it only in tests.

## Cancellation

Pass an `AbortSignal`. Aborting during a wait rejects immediately with `AbortedError` (the
signal's `reason` is the `cause`). Aborting while `fn` runs converts the next failure into
`AbortedError`. `fn` itself is not interrupted: pass the same signal to the underlying operation.

## Observability

`onRetry({ attempt, delayMs, error })` fires before each wait. Use it for logging or metrics. A
throwing hook never alters retry behavior.

## Outcomes

| Situation | Result |
| --- | --- |
| `fn` succeeds | resolves with its value |
| retries used up | rejects `RetryExhaustedError` (`attempts`, `cause` = last error) |
| `shouldRetry` returns `false` | rejects with the original error, unchanged |
| aborted | rejects `AbortedError` |
| bad options | rejects `InvalidOptionError` |

Example: [`examples/full-tour.mjs`](https://github.com/DipanshuHandoo/npm-package-boilerplate/blob/main/examples/full-tour.mjs).
