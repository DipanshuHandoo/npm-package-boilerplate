import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  captureNpm,
  fail,
  log,
  readConfig,
  readPackage,
  root,
  runBin,
  runNode,
  runNpm,
} from "./lib/util.mjs";

const packOnly = process.argv.includes("--pack-only");
const config = readConfig();
const pkg = readPackage();
const problems = [];
const problem = (message) => problems.push(message);

const FORBIDDEN = [
  /^(src|test|scripts|examples|\.github|\.changeset|coverage|\.tmp)\//,
  /(^|\/)node_modules\//,
  /(^|\/)\.env(\.|$)/,
  /\.tgz$/,
  /^(biome|tsconfig[^/]*|boilerplate\.config)\.json$/,
];

function expectedFiles() {
  const files = ["package.json", "LICENSE", "README.md", "CHANGELOG.md"];
  for (const name of Object.keys(config.entries)) {
    for (const dir of ["esm", "cjs"]) {
      for (const suffix of ["", ".min"]) {
        files.push(`dist/${dir}/${name}${suffix}.js`, `dist/${dir}/${name}${suffix}.js.map`);
      }
      files.push(`dist/${dir}/${name}.d.ts`);
    }
    if (config.browser) {
      files.push(`dist/browser/${name}.js`, `dist/browser/${name}.min.js`);
      files.push(`dist/browser/${name}.js.map`, `dist/browser/${name}.min.js.map`);
    }
  }
  files.push("dist/cjs/package.json");
  return files;
}

function exportTargets(value, trail = [], found = []) {
  if (typeof value === "string") found.push({ target: value, trail });
  else if (value && typeof value === "object") {
    for (const [key, next] of Object.entries(value)) exportTargets(next, [...trail, key], found);
  }
  return found;
}

function validateConditionOrder(value, where) {
  if (!value || typeof value !== "object") return;
  const keys = Object.keys(value);
  if (
    keys.includes("types") &&
    keys.includes("default") &&
    keys.indexOf("types") > keys.indexOf("default")
  ) {
    problem(`exports ${where}: "types" must come before "default"`);
  }
  for (const key of keys) validateConditionOrder(value[key], `${where}.${key}`);
}

function validateManifest(packResult) {
  const paths = new Set(packResult.files.map((file) => file.path));

  for (const required of expectedFiles()) {
    if (!paths.has(required)) problem(`missing from tarball: ${required}`);
  }
  for (const file of paths) {
    if (FORBIDDEN.some((pattern) => pattern.test(file))) problem(`forbidden in tarball: ${file}`);
  }
  for (const { target, trail } of exportTargets(pkg.exports)) {
    if (!paths.has(target.replace(/^\.\//, ""))) {
      problem(`exports ${trail.join(".")} points to missing file ${target}`);
    }
  }
  for (const field of ["main", "module", "types"]) {
    if (pkg[field] && !paths.has(pkg[field].replace(/^\.\//, ""))) {
      problem(`"${field}" points to missing file ${pkg[field]}`);
    }
  }
  validateConditionOrder(pkg.exports, "exports");

  const { packedKb, unpackedKb } = config.sizeBudget;
  const packed = packResult.size / 1024;
  const unpacked = packResult.unpackedSize / 1024;
  if (packed > packedKb)
    problem(`packed size ${packed.toFixed(1)} kB exceeds budget ${packedKb} kB`);
  if (unpacked > unpackedKb) {
    problem(`unpacked size ${unpacked.toFixed(1)} kB exceeds budget ${unpackedKb} kB`);
  }
  console.log(
    `Tarball: ${packResult.files.length} files, ${packed.toFixed(1)} kB packed, ${unpacked.toFixed(1)} kB unpacked`,
  );
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function validateSourceMaps(installedDir) {
  const leaks = [root, os.homedir()].map((p) => p.replaceAll("\\", "/").toLowerCase());
  for (const file of walk(installedDir).filter((f) => f.endsWith(".map"))) {
    const text = readFileSync(file, "utf8");
    const map = JSON.parse(text);
    for (const source of map.sources ?? []) {
      if (path.isAbsolute(source) || /^[a-z]:[\\/]/i.test(source)) {
        problem(`${path.relative(installedDir, file)}: absolute source path "${source}"`);
      }
    }
    const normalized = text.replaceAll("\\\\", "/").toLowerCase();
    if (leaks.some((leak) => normalized.includes(leak))) {
      problem(`${path.relative(installedDir, file)}: contains a machine-specific path`);
    }
  }
}

const consumerScript = `
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { specifiers, minified } = JSON.parse(process.argv[2]);
const keys = (value) => Object.keys(value).filter((k) => k !== "__esModule" && k !== "default").sort();
const failures = [];
for (const spec of specifiers) {
  const esm = keys(await import(spec));
  const cjs = keys(require(spec));
  if (esm.length === 0) failures.push(spec + ": no ESM exports");
  if (JSON.stringify(esm) !== JSON.stringify(cjs)) {
    failures.push(spec + ": ESM exports [" + esm + "] differ from CJS exports [" + cjs + "]");
  }
}
for (const { esm, cjs } of minified) {
  const a = keys(await import(pathToFileURL(esm).href));
  const b = keys(require(cjs));
  if (a.length === 0 || JSON.stringify(a) !== JSON.stringify(b)) {
    failures.push("minified build mismatch: " + esm);
  }
}
if (failures.length) { console.error(failures.join("\\n")); process.exit(1); }
console.log("Runtime check ok: " + specifiers.join(", ") + " (ESM, CJS, minified)");
`;

async function main() {
  if (!existsSync(path.join(root, "dist"))) {
    throw new Error("dist/ not found. Run `npm run build` first.");
  }

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "pkg-check-"));
  try {
    log("Packing tarball");
    const packed = await captureNpm([
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      tmpRoot,
    ]);
    if (packed.code !== 0) throw new Error(`npm pack failed:\n${packed.stderr}`);
    const parsed = JSON.parse(packed.stdout);
    const result = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
    const tarball = path.join(tmpRoot, result.filename);

    validateManifest(result);
    if (problems.length) throw new Error(`Package contents invalid:\n - ${problems.join("\n - ")}`);
    if (packOnly) {
      console.log("pack:check passed");
      return;
    }

    const consumer = path.join(tmpRoot, "consumer");
    mkdirSync(consumer);
    writeFileSync(
      path.join(consumer, "package.json"),
      JSON.stringify({ name: "consumer", private: true, type: "module" }),
    );

    log("Installing tarball into an isolated consumer");
    await runNpm(["install", "--no-audit", "--no-fund", "--ignore-scripts", tarball], {
      cwd: consumer,
    });
    const installed = path.join(consumer, "node_modules", ...pkg.name.split("/"));

    validateSourceMaps(installed);
    if (problems.length) throw new Error(`Package contents invalid:\n - ${problems.join("\n - ")}`);

    log("Checking runtime exports (ESM, CommonJS, minified)");
    const specifiers = Object.keys(pkg.exports)
      .filter((key) => key !== "./package.json")
      .map((key) => (key === "." ? pkg.name : `${pkg.name}/${key.slice(2)}`));
    const minified = Object.keys(config.entries).map((name) => ({
      esm: path.join(installed, "dist", "esm", `${name}.min.js`),
      cjs: path.join(installed, "dist", "cjs", `${name}.min.js`),
    }));
    writeFileSync(path.join(consumer, "check.mjs"), consumerScript);
    await runNode(["check.mjs", JSON.stringify({ specifiers, minified })], { cwd: consumer });

    log("Checking TypeScript resolution (ESM and CommonJS consumers)");
    const fixtures = path.join(root, "test", "types");
    mkdirSync(path.join(consumer, "ts"));
    for (const file of readdirSync(fixtures)) {
      cpSync(path.join(fixtures, file), path.join(consumer, "ts", file));
    }
    const fixtureFiles = readdirSync(path.join(consumer, "ts")).map((f) => path.join("ts", f));
    await runBin(
      "typescript",
      "tsc",
      [
        "--noEmit",
        "--strict",
        "--target",
        "es2022",
        "--lib",
        "es2023,dom",
        "--module",
        "nodenext",
        "--moduleResolution",
        "nodenext",
        "--types",
        "",
        ...fixtureFiles,
      ],
      { cwd: consumer },
    );

    log("publint");
    await runBin("publint", "publint", ["run", tarball, "--level", "warning", "--strict"]);

    log("Are the Types Wrong");
    await runBin("@arethetypeswrong/cli", "attw", [tarball, "--profile", "node16"]);

    const examplesDir = path.join(root, "examples");
    if (existsSync(examplesDir)) {
      log("Running examples against the installed tarball");
      cpSync(examplesDir, path.join(consumer, "examples"), { recursive: true });
      const runnable = readdirSync(path.join(consumer, "examples")).filter(
        (f) => f.endsWith(".mjs") && !f.startsWith("_"),
      );
      for (const file of runnable) {
        console.log(`  examples/${file}`);
        await runNode([path.join("examples", file)], {
          cwd: consumer,
          stdio: ["ignore", "ignore", "inherit"],
        });
      }
    }

    console.log(`\nPackage check passed: ${pathToFileURL(tarball).pathname.split("/").pop()}`);
  } finally {
    const resolved = path.resolve(tmpRoot);
    if (
      path.dirname(resolved) === path.resolve(os.tmpdir()) &&
      path.basename(resolved).startsWith("pkg-check-")
    ) {
      rmSync(resolved, { recursive: true, force: true });
    }
  }
}

main().catch((error) => fail(error));
