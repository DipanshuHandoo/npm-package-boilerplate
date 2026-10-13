import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { capture, fail, log, readConfig, readJson, root, runNpm } from "./lib/util.mjs";

// Usage: npm run init -- --name @scope/pkg --description "..." --owner me --language ts --browser false
const TEMPLATE = {
  repo: "DipanshuHandoo/npm-package-boilerplate",
  name: "npm-package-boilerplate",
  global: "NpmPackageBoilerplate",
  author: "Dipanshu Handoo",
  owner: "DipanshuHandoo",
};

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".tmp"]);
const SKIP_FILES = new Set([path.join("scripts", "init.mjs")]);
const NAME_PATTERN = /^(@[a-z0-9][a-z0-9-._]*\/)?[a-z0-9][a-z0-9-._]*$/;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const toPascal = (value) => {
  const pascal = value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return /^[A-Za-z_]/.test(pascal) ? pascal : `_${pascal}`;
};

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return SKIP_DIRS.has(entry.name) ? [] : walk(path.join(dir, entry.name));
    return [path.join(dir, entry.name)];
  });
}

const isText = (buffer) => !buffer.includes(0);

function replaceTokens(replacements) {
  for (const file of walk(root)) {
    const relative = path.relative(root, file);
    if (SKIP_FILES.has(relative) || statSync(file).size > 2_000_000) continue;
    const buffer = readFileSync(file);
    if (!isText(buffer)) continue;
    let text = buffer.toString("utf8");
    const original = text;
    for (const [from, to] of replacements) text = text.replaceAll(from, to);
    if (text !== original) writeFileSync(file, text);
  }
}

function applyBrowserMarkers(enabled) {
  const block = /<!-- browser:start -->[\s\S]*?<!-- browser:end -->\r?\n?/g;
  const marker = /<!-- browser:(start|end) -->\r?\n?/g;
  for (const file of walk(root).filter((f) => f.endsWith(".md"))) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("<!-- browser:")) continue;
    writeFileSync(file, enabled ? text.replace(marker, "") : text.replace(block, ""));
  }
}

async function gather(args) {
  const interactive = process.stdin.isTTY && !args.yes;
  const rl = interactive
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  const ask = async (key, question, fallback) => {
    if (args[key] !== undefined && args[key] !== true) return String(args[key]);
    if (!rl) return fallback;
    const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ""}: `)).trim();
    return answer || fallback;
  };

  const gitUser = (await capture("git", ["config", "user.name"])).stdout.trim();
  const remote = (await capture("git", ["remote", "get-url", "origin"])).stdout.trim();
  const remoteMatch = remote.match(/github\.com[:/]([^/]+)\/([^/.\s]+)/);

  const name = await ask("name", "Package name (e.g. my-lib or @scope/my-lib)", "");
  if (!name || !NAME_PATTERN.test(name)) throw new Error(`Invalid or missing --name "${name}"`);
  const bare = name.replace(/^@[^/]+\//, "");

  const description = await ask("description", "Description", "TODO: describe this package");
  const author = await ask("author", "Author name", gitUser || TEMPLATE.author);
  const owner = await ask("owner", "GitHub owner", remoteMatch?.[1] ?? TEMPLATE.owner);
  const repo = await ask(
    "repo",
    "GitHub repository (owner/name)",
    remoteMatch ? `${remoteMatch[1]}/${remoteMatch[2]}` : `${owner}/${bare}`,
  );
  const language = await ask("language", "Language (ts|js)", "ts");
  const browser = (await ask("browser", "Include browser bundle (true|false)", "false")) === "true";
  const nodeMin = await ask("node-min", "Minimum Node.js version", "22.18.0");
  const nodeMatrix = (await ask("node-matrix", "CI Node major versions (comma separated)", "22,24"))
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  rl?.close();

  if (!["ts", "js"].includes(language))
    throw new Error(`--language must be ts or js, received "${language}"`);
  if (!/^\d+\.\d+\.\d+$/.test(nodeMin))
    throw new Error(`--node-min must look like 22.18.0, received "${nodeMin}"`);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo))
    throw new Error(`--repo must be owner/name, received "${repo}"`);
  if (nodeMatrix.some((v) => !/^\d+$/.test(v)))
    throw new Error("--node-matrix must list major versions, e.g. 22,24");
  const [minMajor, minMinor] = nodeMin.split(".").map(Number);
  if (language === "ts" && (minMajor < 22 || (minMajor === 22 && minMinor < 18))) {
    throw new Error(
      "TypeScript tests run via Node type stripping, which needs Node >= 22.18.0. Use --language js or raise --node-min.",
    );
  }

  return { name, bare, description, author, owner, repo, language, browser, nodeMin, nodeMatrix };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pkgPath = path.join(root, "package.json");
  if (readJson(pkgPath).name !== TEMPLATE.name && !args.force) {
    throw new Error(
      "This repository is already initialised (package name differs from the template). Use --force to override.",
    );
  }
  const answers = await gather(args);
  const config = readConfig();

  log("Applying language variant");
  if (answers.language === "js") {
    for (const dir of ["src", "test"]) {
      for (const file of readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".ts"))) {
        rmSync(path.join(root, dir, file));
      }
    }
    cpSync(path.join(root, "scripts", "variants", "js"), root, { recursive: true });
  }
  config.language = answers.language;

  log("Applying browser option");
  const pkg = readJson(pkgPath);
  config.browser = answers.browser;
  if (answers.browser) {
    cpSync(
      path.join(root, "scripts", "variants", "browser", "check-browser.mjs"),
      path.join(root, "scripts", "check-browser.mjs"),
    );
    pkg.scripts["test:browser"] = "node scripts/check-browser.mjs";
    pkg.unpkg = "./dist/browser/index.min.js";
    pkg.jsdelivr = "./dist/browser/index.min.js";
  }

  log("Rewriting package identity");
  const globalName = toPascal(answers.bare);
  config.globalName = globalName;
  config.nodeTarget = `node${answers.nodeMin.split(".")[0]}`;
  writeFileSync(path.join(root, "boilerplate.config.json"), `${JSON.stringify(config, null, 2)}\n`);

  pkg.description = answers.description;
  pkg.version = "0.0.0";
  pkg.keywords = [];
  pkg.engines.node = `>=${answers.nodeMin}`;
  delete pkg.scripts.init;
  delete pkg.scripts["test:template"];
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  cpSync(path.join(root, "scripts", "variants", "README.package.md"), path.join(root, "README.md"));
  const ci = path.join(root, ".github", "workflows", "ci.yml");
  if (existsSync(ci)) {
    writeFileSync(
      ci,
      readFileSync(ci, "utf8").replace(
        /node-version: \[[^\]]*\]/,
        `node-version: [${answers.nodeMatrix.join(", ")}]`,
      ),
    );
  }
  writeFileSync(path.join(root, ".nvmrc"), `${answers.nodeMatrix.at(-1)}\n`);

  // Order matters: the longest, most specific tokens must be replaced first.
  replaceTokens([
    [TEMPLATE.repo, answers.repo],
    [TEMPLATE.name, answers.name],
    [TEMPLATE.global, globalName],
    [TEMPLATE.author, answers.author],
    [TEMPLATE.owner, answers.owner],
  ]);
  applyBrowserMarkers(answers.browser);

  writeFileSync(
    path.join(root, ".changeset", "initial-release.md"),
    `---\n"${answers.name}": minor\n---\n\nInitial release.\n`,
  );

  log("Removing template-only files");
  rmSync(path.join(root, "scripts", "variants"), { recursive: true, force: true });
  rmSync(path.join(root, "template-docs"), { recursive: true, force: true });
  rmSync(path.join(root, ".github", "workflows", "template-check.yml"), { force: true });

  if (!args["no-install"]) {
    log("Installing dependencies (regenerates package-lock.json)");
    await runNpm(["install"]);
    if (answers.browser) await runNpm(["install", "--save-dev", "playwright"]);
    await runNpm(["run", "format", "--silent"]);
  }

  rmSync(path.join(root, "scripts", "init.mjs"));

  console.log(`\nInitialised ${answers.name} (${answers.language}, browser: ${answers.browser}).`);
  console.log("Next steps:");
  if (args["no-install"]) {
    console.log("  npm install" + (answers.browser ? " && npm install -D playwright" : ""));
  }
  console.log("  1. Replace src/ with your package, update docs/, examples/ and README.md");
  console.log("  2. npm run verify");
  console.log(
    "  3. Complete the one-time GitHub/npm setup in MAINTAINING.md before the first release",
  );
  if (answers.browser)
    console.log("  4. npx playwright install chromium  (needed once for test:browser)");
}

main().catch((error) => fail(error));
