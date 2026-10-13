// CommonJS consumer fixture: compiled against the installed tarball with module=nodenext.
import pkg = require("npm-package-boilerplate");

const value: Promise<number> = pkg.withRetry(async (attempt) => attempt, { retries: 1 });
const options: pkg.RetryOptions = { retries: 1 };

declare const error: unknown;
if (pkg.isPackageError(error)) {
  const code: string = error.code;
  void code;
}
void value;
void options;
