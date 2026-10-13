# Architecture

How to organise `src/` as a package grows. The default is deliberately small; add structure only
when a trigger below fires. Not published to npm.

## Default: flat modules

```text
src/
  index.ts        # the only public surface; re-export deliberately
  types.ts        # shared public types
  errors.ts       # typed error contract
  <feature>.ts    # one focused module per capability (retry.ts)
test/
  <feature>.test.ts   # mirrors src/
  helpers.ts
  types/              # ESM + CJS consumer fixtures
```

Most utility libraries never need more than this. Do not add folders speculatively, and do not
create empty placeholder files.

## When to split

| Trigger | Action |
| --- | --- |
| A module passes roughly 300 lines or has two unrelated reasons to change | Split into focused modules |
| The same code is used by two or more modules | Extract to `utils/` (not before) |
| Code performs I/O (HTTP, filesystem, database, queue) and tests need to fake it | Move behind an adapter in `infrastructure/` |
| Several features must be composed into one workflow | Add an orchestrating function in `services/` |
| Code imports Node-only modules but the package ships a browser build | Put it in its own subpath entry |
| A feature needs more than three files | Promote it to `src/<feature>/` |

## Layout once a package outgrows flat

```text
src/
  index.ts                 # public exports only
  config.ts                # defaults, option validation, shared config types
  errors.ts                # error classes or factories, error codes
  types.ts                 # shared public types
  <feature>/               # domain logic, pure where possible
    index.ts
    <feature>.ts
  services/                # orchestration that composes features
    <workflow>.ts
  infrastructure/          # I/O adapters, injected into services
    http.ts
    storage.ts
  utils/                   # small dependency-free helpers
    <helper>.ts
test/                      # mirrors src/ one to one
```

| Folder | Responsibility | May import | Must not import |
| --- | --- | --- | --- |
| `utils/` | Pure helpers with no domain knowledge | nothing internal | features, services, infrastructure |
| `types.ts`, `errors.ts`, `config.ts` | Shared contracts | `utils/` | features, services, infrastructure |
| `<feature>/` | Domain logic | `utils/`, shared contracts | services, infrastructure |
| `infrastructure/` | Adapters to the outside world | `utils/`, shared contracts | features, services |
| `services/` | Compose features and adapters into workflows | everything above | `index.ts` |
| `index.ts` | Public API | `services/`, features, shared contracts | `infrastructure/` internals |

Dependency direction: `index` to `services` to `features` to `utils`, `types`, `errors`.
Infrastructure is passed into services as an argument; features never import it.

## Conventions

- **Functional style.** Export functions, not classes. Use a class only for real stateful
  lifecycle, identity or compatibility.
- **Dependency injection by parameter.** A service receives its adapters as arguments, so tests
  pass fakes and no module-level singleton holds state.
- **Explicit public API.** `index.ts` lists every export by name. Never `export *` from internal
  modules, and never document an import path that is not in `exports`.
- **Explicit extensions.** Source imports use `.ts` (or `.js` for JS packages); the build rewrites them.
- **Subpath entries** for optional, testing or Node-only code: add the entry to
  `boilerplate.config.json` and an `exports` branch; `check-package` verifies ESM/CJS parity.
- **Errors are contracts.** Throw typed errors with a `cause`. Never swallow failures or return a
  success-shaped default.
- **Observability by hook.** Accept `onRetry`/`onEvent` style callbacks instead of importing a logger.
- **Retries only where safe.** Bounded attempts and delay, idempotency considered, cancellation honoured.
- **Scale.** For high-volume work prefer bounded concurrency, batching, streaming and cursor
  pagination; use worker threads only for CPU-bound work and a queue only for durable async work.
- **Tests mirror `src/`.** One test file per module, fakes for adapters, integration tests only
  at real boundaries.

## Anti-patterns

- A catch-all `utils.ts` that collects unrelated helpers.
- Layers created before there is something to put in them.
- Circular imports between modules.
- Features importing `infrastructure/` directly (breaks testing and the dependency rule).
- Exporting internals "temporarily".
- Module-level mutable state shared across calls.

## Worked example: growing `withRetry`

Suppose the package gains an HTTP client that retries and records metrics. Flat modules still
work until the I/O appears.

```text
src/
  index.ts
  errors.ts
  types.ts
  config.ts                  # option defaults and validation
  retry/
    index.ts
    retry.ts                 # withRetry, pure; takes shouldRetry and onRetry
    backoff.ts               # delay and jitter calculation
  services/
    fetch-with-retry.ts      # composes retry + an injected transport
  infrastructure/
    http-transport.ts        # the only place that calls fetch
  utils/
    sleep.ts                 # abortable sleep, used by retry and services
```

`retry/` stays pure and is tested with fake timers. `services/fetch-with-retry.ts` takes a
`transport` argument, so its tests pass a fake and never touch the network.
`infrastructure/http-transport.ts` is exercised by one integration test against a local server.
`index.ts` exports `withRetry` and `fetchWithRetry` by name.

## Review checklist

- Does a split trigger actually apply, or is this speculative structure?
- Do imports follow the dependency table?
- Is every new export intentional, documented and covered by `test:package`?
- Are adapters injected rather than imported by features?
- Is there a changeset?
