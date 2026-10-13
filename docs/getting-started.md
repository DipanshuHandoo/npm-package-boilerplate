# Getting started

## Requirements

Node.js >= 22.18.0. The package ships ESM and CommonJS builds with TypeScript declarations.

## Install

```sh
npm install npm-package-boilerplate
```

## First call

```js
import { withRetry } from "npm-package-boilerplate";

const result = await withRetry(async (attempt) => callService(attempt));
```

```js
// CommonJS
const { withRetry } = require("npm-package-boilerplate");
```

<!-- browser:start -->
## Browser

A global-script build is published at `dist/browser/index.min.js` and exposes
`NpmPackageBoilerplate`:

```html
<script src="https://unpkg.com/npm-package-boilerplate/dist/browser/index.min.js"></script>
```

<!-- browser:end -->
## Next steps

- [Retry guide](retry.md) for backoff, cancellation and hooks
- [Configuration](configuration.md) for every option and default
- [Errors and messages](errors-and-messages.md)
