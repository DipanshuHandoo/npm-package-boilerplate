# npm-package-boilerplate

Production-grade starting point for Node.js npm packages: one architecture, one release process,
reused across every package. It ships a small working library (`withRetry`) so the whole
toolchain is exercised end to end; replace it with your own code.

**Use this as a template:** click **Use this template** on GitHub, clone, then run
`npm run init`.

## What you get

| Area | Included |
| --- | --- |
| Language | TypeScript (default) or JavaScript + JSDoc, chosen at init |
| Builds | ESM + CommonJS (+ minified, source maps) via esbuild; declarations via `tsc`; optional browser IIFE |
| Quality | Biome lint/format (warnings fail), strict TypeScript, Node test runner, coverage gates (90/80/85) |
| Artifact checks | Real tarball installed into a temp project; ESM/CJS/minified parity, TS resolution in both module modes, publint, Are the Types Wrong, forbidden-file and source-map checks, size budget, examples run against the tarball |
| Versioning | Changesets (PR-based bumps, generated `CHANGELOG.md`) |
| CI | Linux + Windows, Node 22 and 24, `npm audit`, CodeQL, Dependabot, SHA-pinned actions, read-only permissions |
| Release | Manual `workflow_dispatch`, environment approval, npm trusted publishing + provenance, publishes the exact verified tarball, tag + GitHub release |
| Docs | README, `docs/`, `examples/`, SECURITY, CONTRIBUTING, MAINTAINING (release runbook), issue/PR templates |

## Create a package

```sh
npm ci
npm run init -- --name @scope/my-lib --description "What it does" --language ts --browser false
```

Run without flags for interactive prompts. Options:

| Flag | Default | Meaning |
| --- | --- | --- |
| `--name` | required | Package name, scoped or unscoped |
| `--description`, `--author` | git user | Metadata |
| `--owner`, `--repo` | from `origin` | GitHub owner and `owner/name` |
| `--language` | `ts` | `ts` or `js` |
| `--browser` | `false` | Add `dist/browser` bundles, Playwright check and CDN fields |
| `--node-min` | `22.18.0` | `engines.node` and esbuild target (TypeScript needs >= 22.18 for native type stripping) |
| `--node-matrix` | `22,24` | CI Node majors |
| `--no-install` | off | Skip `npm install`/formatting |
| `--yes` | off | Non-interactive |

`init` rewrites names and URLs, applies the language and browser variants, rewrites the README
for your package, adds an initial changeset, regenerates the lockfile, then removes itself and
all template-only files. Then replace `src/`, `docs/`, `examples/` with your package, run
`npm run verify`, and finish the one-time setup in [MAINTAINING.md](MAINTAINING.md).
Template-level setup and the release-pipeline test steps are in
[template-docs/setup-and-release-test.md](template-docs/setup-and-release-test.md).

The template is itself tested: `.github/workflows/template-check.yml` initialises every variant
and runs `npm run verify`.

## Layout

```text
src/                 public API (index.ts is the only entry), errors, types, focused modules
test/                *.test.ts, helpers, types/ (ESM + CJS TypeScript consumer fixtures)
scripts/             cross-platform Node automation (no shell dependence)
docs/ examples/      shipped docs; runnable examples that import the public package name
.github/             ci, release, version, codeql workflows; templates; dependabot; CODEOWNERS
.changeset/          pending release notes
boilerplate.config.json   language, browser, entries, build targets, size budget, coverage gates
```

How to grow `src/` (utils, services, infrastructure) is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Commands

| Command | Responsibility |
| --- | --- |
| `clean` | Remove `dist`, `coverage`, `.tmp` |
| `build` | Bundles, source maps, declarations |
| `test` / `test:coverage` | Tests / tests with enforced thresholds |
| `lint` / `format` / `format:check` / `typecheck` | Biome and TypeScript |
| `test:package` | Pack, install in an isolated consumer, validate everything |
| `pack:check` | Validate tarball contents and size only |
| `test:browser` | Browser artifact check (browser option only) |
| `verify` | clean → typecheck → lint → format:check → coverage → build → test:package (→ test:browser) |
| `publish:dry` | `npm publish --dry-run` |
| `release` | Local preflight; never publishes |
| `changeset` / `version` | Add a changeset / apply versions |

Local publishing is blocked by `prepublishOnly`; releases go through the manual workflow.

## Design notes

- Runtime dependencies: none. Dev tools: esbuild, TypeScript, Biome, Changesets, publint,
  Are the Types Wrong (and Playwright only with the browser option).
- TypeScript runs tests through Node's native type stripping, so source is limited to erasable
  syntax (no enums or parameter properties) and uses explicit `.ts` import specifiers, which the
  build rewrites to `.js`.
- Subpath exports: add an entry in `boilerplate.config.json` and an `exports` branch; the
  package check validates ESM/CJS parity for every export.

## License

MIT
