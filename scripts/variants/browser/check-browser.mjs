import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { fail, readConfig, readPackage, root } from "./lib/util.mjs";

const config = readConfig();
const pkg = readPackage();

async function main() {
  const esm = await import(pathToFileURL(path.join(root, "dist", "esm", "index.js")).href);
  const expected = Object.keys(esm).sort();
  if (expected.length === 0) throw new Error("dist/esm/index.js has no exports");

  const browser = await chromium.launch();
  try {
    for (const file of ["index.js", "index.min.js"]) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.setContent("<!doctype html><html><body></body></html>");
      await page.addScriptTag({ path: path.join(root, "dist", "browser", file) });

      const keys = await page.evaluate(
        (name) => Object.keys(window[name] ?? {}).sort(),
        config.globalName,
      );
      if (JSON.stringify(keys) !== JSON.stringify(expected)) {
        throw new Error(
          `${file}: window.${config.globalName} exports [${keys}] differ from ESM [${expected}]`,
        );
      }

      // Representative behaviour, not just presence: retry succeeds on the third attempt.
      const attempts = await page.evaluate(async (name) => {
        let calls = 0;
        await window[name].withRetry(
          () => {
            if (++calls < 3) throw new Error("flaky");
          },
          { minDelayMs: 1, maxDelayMs: 2 },
        );
        return calls;
      }, config.globalName);
      if (attempts !== 3) throw new Error(`${file}: expected 3 attempts, got ${attempts}`);
      if (pageErrors.length) throw new Error(`${file}: page errors: ${pageErrors.join("; ")}`);
      await page.close();
      console.log(`Browser check ok: dist/browser/${file} (${pkg.name})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => fail(error));
