import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { capture, captureNpm, fail, readJson, readPackage, root, runNode } from "./lib/util.mjs";

// Modes:
//   (default)           local preflight; never publishes
//   --ci --expect-version <v>   same checks for the release workflow (no clean-tree requirement)
//   --print-dist-tag    prints "latest" or "next" for the current version
//   --notes             prints the CHANGELOG section for the current version
//   --prepublish-guard  used by the prepublishOnly lifecycle script
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const pkg = readPackage();
const isPrerelease = pkg.version.includes("-");
const distTag = isPrerelease ? "next" : "latest";

function changelogSection(version) {
  const text = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const lines = text.split(/\r?\n/);
  const escaped = version.replaceAll(".", "\\.");
  const start = lines.findIndex((line) =>
    new RegExp(`^##\\s+\\[?v?${escaped}\\]?(\\s|$)`).test(line),
  );
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join("\n")
    .trim();
}

function pendingChangesets() {
  const dir = path.join(root, ".changeset");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
}

async function checkRegistry(failures, notes) {
  const spec = `${pkg.name}@${pkg.version}`;
  const result = await captureNpm(["view", spec, "version", "--json"]);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.code === 0 && result.stdout.trim()) {
    failures.push(`${spec} is already published`);
  } else if (/E404|404 Not Found|is not in this registry/i.test(output)) {
    notes.push(`${spec} is not yet published (registry returned 404)`);
  } else {
    // Auth, network and registry errors are not evidence that the version is free.
    failures.push(`could not determine whether ${spec} exists:\n${output.trim()}`);
  }
}

async function preflight() {
  const failures = [];
  const notes = [];
  const expected = option("--expect-version");

  if (pkg.private) failures.push('package.json has "private": true');
  if (expected && expected !== pkg.version) {
    failures.push(`package.json version ${pkg.version} does not match expected ${expected}`);
  }
  if (pkg.version === "0.0.0")
    failures.push("version is still 0.0.0 (merge the Version Packages PR first)");

  const lock = readJson(path.join(root, "package-lock.json"));
  if (lock.version !== pkg.version || lock.packages?.[""]?.version !== pkg.version) {
    failures.push("package-lock.json version does not match package.json (run npm run version)");
  }

  const section = changelogSection(pkg.version);
  if (section === null) failures.push(`CHANGELOG.md has no section for ${pkg.version}`);
  else if (!section) failures.push(`CHANGELOG.md section for ${pkg.version} is empty`);

  const pending = pendingChangesets();
  if (pending.length) failures.push(`unreleased changesets pending: ${pending.join(", ")}`);

  if (!flag("--ci")) {
    const status = await capture("git", ["status", "--porcelain"]);
    if (status.stdout.trim()) failures.push("git working tree is not clean");
    const branch = (await capture("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    notes.push(`branch: ${branch}`);
    const ahead = await capture("git", ["rev-list", "--count", "@{u}..HEAD"]);
    if (ahead.code === 0 && Number(ahead.stdout.trim()) > 0) {
      failures.push(
        "local commits have not been pushed; the release workflow uses the pushed commit",
      );
    }
  }

  await checkRegistry(failures, notes);

  console.log(`Package: ${pkg.name}@${pkg.version}  dist-tag: ${distTag}`);
  for (const note of notes) console.log(`  ok: ${note}`);
  if (failures.length) {
    throw new Error(`Release preflight failed:\n - ${failures.join("\n - ")}`);
  }
  console.log("Release preflight passed.");
  if (!flag("--ci")) {
    console.log("\nNext: run the full verification (npm run verify), then start the release:");
    console.log("  gh workflow run release.yml -f confirm-version=" + pkg.version);
    console.log("The workflow re-verifies, waits for 'npm' environment approval, then publishes.");
  }
}

async function prepublishGuard() {
  if (process.env.npm_config_dry_run === "true") {
    await runNode([path.join(root, "scripts", "check-package.mjs"), "--pack-only"]);
    return;
  }
  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error(
      "Local publishing is disabled. Use the manual 'Release' GitHub Actions workflow (see MAINTAINING.md).",
    );
  }
}

async function main() {
  if (flag("--print-dist-tag")) return console.log(distTag);
  if (flag("--notes")) {
    const section = changelogSection(pkg.version);
    if (!section) throw new Error(`No changelog section for ${pkg.version}`);
    return console.log(section);
  }
  if (flag("--prepublish-guard")) return prepublishGuard();
  return preflight();
}

main().catch((error) => fail(error));
