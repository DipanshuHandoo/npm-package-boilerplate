import assert from "node:assert/strict";
import { withRetry } from "npm-package-boilerplate";

let calls = 0;
const result = await withRetry(
  async () => {
    calls++;
    if (calls < 3) throw new Error("transient");
    return "done";
  },
  { minDelayMs: 1, maxDelayMs: 5 },
);

assert.equal(result, "done");
assert.equal(calls, 3);
console.log(`Succeeded after ${calls} attempts: ${result}`);
