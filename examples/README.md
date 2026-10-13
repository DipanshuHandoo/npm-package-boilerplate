# Examples

Runnable examples that import the package through its public entry point. They are not
published to npm.

| File | Shows |
| --- | --- |
| `basic.mjs` | Minimal usage |
| `full-tour.mjs` | Hooks, exhaustion, `shouldRetry`, cancellation, error contract |
| `retry.mjs` | Transient-only retries and CommonJS interop |

Each example asserts its own output, so a non-zero exit means broken behavior.

## Running

`npm run test:package` packs the library, installs the tarball into an isolated temporary
project and runs every `examples/*.mjs` file there (files starting with `_` are helpers and are
not run). This is the supported way to run them.

To run one manually after `npm pack`:

```sh
mkdir /tmp/try && cd /tmp/try && npm init -y && npm i /path/to/package-0.0.0.tgz
node /path/to/examples/basic.mjs   # resolve the package from this folder
```

Examples must not need secrets or live third-party services.
