# npm-package-boilerplate

> TODO: one-sentence description of what this package does.

[![CI](https://github.com/DipanshuHandoo/npm-package-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/DipanshuHandoo/npm-package-boilerplate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/npm-package-boilerplate)](https://www.npmjs.com/package/npm-package-boilerplate)

## Requirements

Node.js >= 22.18.0.

## Install

```sh
npm install npm-package-boilerplate
```

## Quick start

```js
import { withRetry } from "npm-package-boilerplate";

const data = await withRetry(() => fetchSomething(), { retries: 3 });
```

CommonJS:

```js
const { withRetry } = require("npm-package-boilerplate");
```

<!-- browser:start -->
Browser (global `NpmPackageBoilerplate`):

```html
<script src="https://unpkg.com/npm-package-boilerplate/dist/browser/index.min.js"></script>
<script>
  NpmPackageBoilerplate.withRetry(() => doWork());
</script>
```

<!-- browser:end -->
## Advanced usage

```js
import { withRetry, RetryExhaustedError } from "npm-package-boilerplate";

const controller = new AbortController();
try {
  await withRetry((attempt) => callApi(attempt), {
    retries: 5,
    minDelayMs: 200,
    maxDelayMs: 10_000,
    signal: controller.signal,
    shouldRetry: (error) => error.status >= 500,
    onRetry: ({ attempt, delayMs, error }) => console.warn("retrying", { attempt, delayMs, error }),
  });
} catch (error) {
  if (error instanceof RetryExhaustedError) console.error(error.attempts, error.cause);
}
```

## Documentation

- [Getting started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Retry guide](docs/retry.md)
- [API reference](docs/api-reference.md)
- [Errors and messages](docs/errors-and-messages.md)
- [Troubleshooting](docs/troubleshooting.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Maintainers: see [MAINTAINING.md](MAINTAINING.md).

## License

MIT
