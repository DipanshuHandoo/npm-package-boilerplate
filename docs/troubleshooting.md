# Troubleshooting

**`ERR_REQUIRE_ESM` or "Cannot use import statement"** — use the matching syntax: `import` for
ESM, `require` for CommonJS. Both resolve through the package `exports` map.

**TypeScript cannot find types** — use `moduleResolution` `node16`, `nodenext` or `bundler`.
The legacy `node10` resolution is not supported because the package uses `exports`.

**Retries never stop** — an `AbortSignal` is the only way to cancel; pass one. Also check that
`retries` is finite and that `shouldRetry` eventually returns `false`.

**Retries happen too fast/slow in tests** — set `jitter: false` and small `minDelayMs`/`maxDelayMs`.

**A hook seems ignored** — exceptions thrown from `onRetry` are swallowed by design; log inside
the hook itself.
