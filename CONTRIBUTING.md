# Contributing

## Setup

```sh
npm ci
```

Requires Node.js >= 22.18.0 (see `.nvmrc`).

## Workflow

1. Branch from `main`.
2. Make the change with tests. Test public behavior, error paths and cleanup.
3. Run `npm run verify` (clean, typecheck, lint, format check, coverage, build, packed-package
   checks). It must pass before opening a PR.
4. Add a changeset for user-facing changes: `npm run changeset`.
5. Update docs and examples when the public API changes.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run tests |
| `npm run test:coverage` | Tests with coverage thresholds |
| `npm run format` | Apply formatting |
| `npm run lint` | Lint (warnings fail) |
| `npm run typecheck` | Type check |
| `npm run build` | Build `dist/` |
| `npm run test:package` | Pack, install in a temp project, test ESM/CJS/types/examples |
| `npm run verify` | Everything CI runs |

Do not edit `dist/` by hand and do not publish locally; releases are manual workflow runs
(see `MAINTAINING.md`).
