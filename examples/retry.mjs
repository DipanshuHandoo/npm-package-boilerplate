import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { withRetry } from "npm-package-boilerplate";

// Retry only failures that are safe and worth repeating (here: HTTP 429/5xx style errors).
const isTransient = (error) => error?.status === 429 || error?.status >= 500;

let calls = 0;
const response = await withRetry(
  async (attempt) => {
    calls = attempt;
    if (attempt === 1) throw Object.assign(new Error("rate limited"), { status: 429 });
    if (attempt === 2) throw Object.assign(new Error("unavailable"), { status: 503 });
    return { status: 200 };
  },
  { shouldRetry: isTransient, minDelayMs: 1, maxDelayMs: 4 },
);
assert.deepEqual(response, { status: 200 });
assert.equal(calls, 3);

// The same package works from CommonJS.
const cjs = createRequire(import.meta.url)("npm-package-boilerplate");
assert.equal(typeof cjs.withRetry, "function");
assert.equal(await cjs.withRetry(async () => "cjs-ok"), "cjs-ok");

console.log("Transient-only retries and CommonJS interop verified");
