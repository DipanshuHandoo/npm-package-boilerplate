import { AbortedError, isPackageError, PackageError } from "../src/index.ts";
import assert from "node:assert/strict";
import { it } from "node:test";

it("PackageError subclasses carry a stable name, code and cause", () => {
  const cause = new Error("root");
  const error = new AbortedError(cause);
  assert.equal(error.name, "AbortedError");
  assert.equal(error.code, "ERR_ABORTED");
  assert.equal(error.cause, cause);
  assert.ok(error instanceof PackageError);
  assert.equal(isPackageError(new Error("x")), false);
});
