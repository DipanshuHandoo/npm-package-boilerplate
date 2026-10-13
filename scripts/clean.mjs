import { rmSync } from "node:fs";
import path from "node:path";
import { root } from "./lib/util.mjs";

// Only known generated artifacts; every target is resolved and verified to live inside the repo.
const targets = ["dist", "coverage", ".tmp"];

for (const target of targets) {
  const resolved = path.resolve(root, target);
  if (path.dirname(resolved) !== root) {
    throw new Error(`Refusing to remove "${resolved}": not a direct child of the repository root`);
  }
  rmSync(resolved, { recursive: true, force: true });
}

console.log(`Cleaned: ${targets.join(", ")}`);
