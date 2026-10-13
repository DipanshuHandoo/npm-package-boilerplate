import { existsSync } from "node:fs";
import path from "node:path";
import { fail, log, readConfig, root, runNpm } from "./lib/util.mjs";

const config = readConfig();
const steps = [
  "clean",
  "typecheck",
  "lint",
  "format:check",
  "test:coverage",
  "build",
  "test:package",
];

if (config.browser) {
  if (!existsSync(path.join(root, "scripts", "check-browser.mjs"))) {
    fail(
      "Browser support is enabled in boilerplate.config.json but scripts/check-browser.mjs is missing",
    );
    process.exit();
  }
  steps.push("test:browser");
} else {
  console.log("Browser checks: disabled (boilerplate.config.json: browser=false)");
}

try {
  for (const step of steps) {
    log(`npm run ${step}`);
    await runNpm(["run", step, "--silent"]);
  }
  console.log(`\nverify passed: ${steps.join(" -> ")}`);
} catch (error) {
  fail(error);
}
