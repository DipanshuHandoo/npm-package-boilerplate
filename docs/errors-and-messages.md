# Errors and messages

Every error thrown deliberately by this package extends `PackageError` and has a stable `code`.
Branch on `code` or `instanceof`, never on message text.

| Class | `code` | Extra fields | When |
| --- | --- | --- | --- |
| `InvalidOptionError` | `ERR_INVALID_OPTION` | | An option has an invalid value; thrown before `fn` runs |
| `RetryExhaustedError` | `ERR_RETRY_EXHAUSTED` | `attempts` | All attempts failed; `cause` is the last error |
| `AbortedError` | `ERR_ABORTED` | | The `AbortSignal` fired; `cause` is the signal reason |

Errors thrown by your own function are never swallowed: they surface either as the `cause` of
`RetryExhaustedError` or, when `shouldRetry` returns `false`, unchanged.
