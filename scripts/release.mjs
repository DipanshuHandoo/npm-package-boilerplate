import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import {
  capture,
  captureNpm,
  fail,
  log,
  readJson,
  readPackage,
  root,
  run,
  runNode,
  runNpm,
} from "./lib/util.mjs";

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

async function preflight({ quiet = false } = {}) {
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
  if (!flag("--ci") && !quiet) {
    console.log("\nNext: run the full verification (npm run verify), then release either way:");
    console.log("  Local:  npm run release:local");
    console.log("  Actions: gh workflow run release.yml -f confirm-version=" + pkg.version);
    console.log("The workflow needs an npm Trusted Publisher configured (see MAINTAINING.md).");
  }
}

async function prepublishGuard() {
  if (process.env.npm_config_dry_run === "true") {
    await runNode([path.join(root, "scripts", "check-package.mjs"), "--pack-only"]);
    return;
  }
  if (process.env.GITHUB_ACTIONS !== "true" && process.env.BOILERPLATE_LOCAL_RELEASE !== "1") {
    throw new Error(
      "Direct publishing is disabled. Use 'npm run release:local' or the manual 'Release' GitHub Actions workflow (see MAINTAINING.md).",
    );
  }
}

async function git(...gitArgs) {
  const result = await capture("git", gitArgs);
  if (result.code !== 0) {
    throw new Error(`git ${gitArgs.join(" ")} failed:\n${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

async function defaultBranch() {
  const ref = await capture("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  return ref.code === 0 ? ref.stdout.trim().replace(/^origin\//, "") : "main";
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function ensureNpmLogin() {
  const who = await captureNpm(["whoami"]);
  if (who.code === 0) return console.log(`npm user: ${who.stdout.trim()}`);
  console.log("Not logged in to npm. Opening the browser login...");
  await runNpm(["login", "--auth-type=web"]);
  const after = await captureNpm(["whoami"]);
  if (after.code !== 0) throw new Error("npm login did not complete");
  console.log(`npm user: ${after.stdout.trim()}`);
}

async function remoteWebUrl() {
  const remote = await git("remote", "get-url", "origin");
  const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  return match ? `https://github.com/${match[1]}` : null;
}

async function createTagAndRelease() {
  const tag = `v${pkg.version}`;
  const head = await git("rev-parse", "HEAD");
  const remoteTag = await capture("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`]);
  if (remoteTag.stdout.trim()) {
    console.log(`Tag ${tag} already exists on origin; skipping tag creation.`);
  } else {
    const localTag = await capture("git", [
      "rev-parse",
      "-q",
      "--verify",
      `refs/tags/${tag}^{commit}`,
    ]);
    if (localTag.code === 0 && localTag.stdout.trim() !== head) {
      throw new Error(`Local tag ${tag} points to a different commit; resolve it manually.`);
    }
    if (localTag.code !== 0) await git("tag", "-a", tag, "-m", tag);
    await runGit(["push", "origin", tag]);
  }

  const notes = changelogSection(pkg.version) ?? "";
  const ghArgs = ["release", "create", tag, "--verify-tag", "--title", tag, "--notes", notes];
  if (isPrerelease) ghArgs.push("--prerelease");
  const url = await remoteWebUrl();
  const repoFlag = url ? ["--repo", url.replace("https://github.com/", "")] : [];
  const gh = await capture("gh", [...ghArgs, ...repoFlag]).catch(() => ({
    code: 1,
    stderr: "gh not available",
  }));
  if (gh.code === 0) return console.log(`GitHub release created: ${gh.stdout.trim()}`);

  console.log("\nCould not create the GitHub release with gh (wrong account or not installed).");
  if (url) {
    const params = new URLSearchParams({ tag, title: tag, prerelease: String(isPrerelease) });
    console.log(`Create it manually: ${url}/releases/new?${params}`);
  }
  console.log(`\nRelease notes:\n${notes}`);
}

const runGit = (gitArgs) => run("git", gitArgs);

async function releaseLocal() {
  if (isPrerelease && !flag("--yes")) log("Prerelease detected: publishing under dist-tag 'next'");

  const branch = await git("rev-parse", "--abbrev-ref", "HEAD");
  const expectedBranch = await defaultBranch();
  if (branch !== expectedBranch) {
    throw new Error(`Releases must run from '${expectedBranch}' (current: '${branch}')`);
  }
  await runGit(["fetch", "origin", expectedBranch, "--tags", "--quiet"]);
  const [head, upstream] = await Promise.all([
    git("rev-parse", "HEAD"),
    git("rev-parse", `origin/${expectedBranch}`),
  ]);
  if (head !== upstream) {
    throw new Error(
      `Local ${expectedBranch} is not identical to origin/${expectedBranch}; pull or push first`,
    );
  }

  log("Release preflight");
  await preflight({ quiet: true });

  log("Full verification");
  await runNpm(["run", "verify"]);

  log("npm authentication");
  await ensureNpmLogin();

  const answer = await confirm(
    `\nPublish ${pkg.name}@${pkg.version} to npm (tag '${distTag}')? Type the version to confirm: `,
  );
  if (answer !== pkg.version)
    throw new Error("Confirmation did not match; aborting before publish");

  log("Publishing");
  await runNpm(["publish", "--tag", distTag, "--access", "public", "--provenance=false"], {
    env: { ...process.env, BOILERPLATE_LOCAL_RELEASE: "1" },
  });

  log("Tag and GitHub release");
  try {
    await createTagAndRelease();
  } catch (error) {
    console.error(`\nPublished to npm, but tag/release step failed: ${error.message}`);
    console.error(`Do NOT republish. Create tag v${pkg.version} and the GitHub release manually.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nReleased ${pkg.name}@${pkg.version}`);
}

async function main() {
  if (flag("--print-dist-tag")) return console.log(distTag);
  if (flag("--notes")) {
    const section = changelogSection(pkg.version);
    if (!section) throw new Error(`No changelog section for ${pkg.version}`);
    return console.log(section);
  }
  if (flag("--prepublish-guard")) return prepublishGuard();
  if (flag("--local")) return releaseLocal();
  return preflight();
}

main().catch((error) => fail(error));
