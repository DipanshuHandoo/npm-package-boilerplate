# Configuration

`withRetry(fn, options)` accepts these options. All are optional.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `retries` | `number` | `3` | Retries after the first attempt. Non-negative integer. `0` disables retrying. |
| `minDelayMs` | `number` | `100` | Delay before the first retry. Non-negative integer. |
| `maxDelayMs` | `number` | `5000` | Upper bound for any single delay. Non-negative integer. |
| `factor` | `number` | `2` | Exponential growth factor. Must be `>= 1`. |
| `jitter` | `boolean` | `true` | Full jitter: each delay is a random value in `[0, computed]`. |
| `signal` | `AbortSignal` | none | Cancels waiting and prevents further attempts. |
| `shouldRetry` | `(error, attempt) => boolean` | retry all | Return `false` to rethrow the original error immediately. |
| `onRetry` | `(info) => void` | none | Logging hook called before each wait. Errors thrown by the hook are ignored. |

Invalid values throw [`InvalidOptionError`](errors-and-messages.md) before `fn` is called.

There is no global state: options are per call, and calls never influence each other.
