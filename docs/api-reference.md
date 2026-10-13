# API reference

Everything below is exported from the package root. Private modules are not part of the API.

## `withRetry<T>(fn, options?): Promise<T>`

Runs `fn(attempt)` (1-based attempt number) until it succeeds or the retry budget is spent.
See [Configuration](configuration.md) for `options` and the [Retry guide](retry.md).

## `computeDelay(retryIndex, options, random?): number`

Pure helper returning the delay for a 0-based retry index. `options` requires `minDelayMs`,
`maxDelayMs`, `factor` and `jitter`; `random` defaults to `Math.random` and exists for tests.

## `isPackageError(value): value is PackageError`

Type guard for any error thrown by this package.

## Error classes

`PackageError` (base, has `code`), `InvalidOptionError`, `RetryExhaustedError` (`attempts`),
`AbortedError`. Details in [Errors and messages](errors-and-messages.md).

## Types

`RetryOptions`, `RetryInfo`, `ErrorCode`.
