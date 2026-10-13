import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const COPIED = [
  "package.json",
  "boilerplate.config.json",
  "LICENSE",
  "README.md",
  "CHANGELOG.md",
  "dist",
  "scripts",
];
const workdirs = [];

function makeCopy() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cp-negative-"));
  workdirs.push(dir);
  for (const name of COPIED) {
    cpSync(path.join(repo, name), path.join(dir, name), { recursive: true });
  }
  return dir;
}

const editJson = (dir, file, mutate) => {
  const target = path.join(dir, file);
  const data = JSON.parse(readFileSync(target, "utf8"));
  mutate(data);
  writeFileSync(target, JSON.stringify(data, null, 2));
};

function packCheck(dir) {
  const result = spawnSync(
    process.execPath,
    [path.join(dir, "scripts", "check-package.mjs"), "--pack-only"],
    { cwd: dir, encoding: "utf8" },
  );
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

describe("check-package rejects broken packages", () => {
  before(() => {
    if (!existsSync(path.join(repo, "dist"))) {
      const build = spawnSync(process.execPath, [path.join(repo, "scripts", "build.mjs")], {
        cwd: repo,
        stdio: "inherit",
      });
      assert.equal(build.status, 0, "build failed");
    }
  });

  after(() => {
    for (const dir of workdirs) {
      if (path.basename(dir).startsWith("cp-negative-")) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("passes on an untouched copy", () => {
    const { code, output } = packCheck(makeCopy());
    assert.equal(code, 0, output);
  });

  it("fails when a required dist file is missing", () => {
    const dir = makeCopy();
    rmSync(path.join(dir, "dist", "esm", "index.min.js"));
    const { code, output } = packCheck(dir);
    assert.notEqual(code, 0);
    assert.match(output, /missing from tarball: dist\/esm\/index\.min\.js/);
  });

  it("fails when forbidden files would be published", () => {
    const dir = makeCopy();
    writeFileSync(path.join(dir, "dist", ".env"), "SECRET=1");
    const { code, output } = packCheck(dir);
    assert.notEqual(code, 0);
    assert.match(output, /forbidden in tarball: dist\/\.env/);
  });

  it("fails when an export points to a missing file", () => {
    const dir = makeCopy();
    editJson(dir, "package.json", (pkg) => {
      pkg.exports["."].import.default = "./dist/esm/nope.js";
    });
    const { code, output } = packCheck(dir);
    assert.notEqual(code, 0);
    assert.match(output, /points to missing file \.\/dist\/esm\/nope\.js/);
  });

  it("fails when types comes after default", () => {
    const dir = makeCopy();
    editJson(dir, "package.json", (pkg) => {
      const { types, default: def } = pkg.exports["."].import;
      pkg.exports["."].import = { default: def, types };
    });
    const { code, output } = packCheck(dir);
    assert.notEqual(code, 0);
    assert.match(output, /"types" must come before "default"/);
  });

  it("fails when the size budget is exceeded", () => {
    const dir = makeCopy();
    editJson(dir, "boilerplate.config.json", (config) => {
      config.sizeBudget = { packedKb: 0.1, unpackedKb: 0.1 };
    });
    const { code, output } = packCheck(dir);
    assert.notEqual(code, 0);
    assert.match(output, /exceeds budget/);
  });
});
