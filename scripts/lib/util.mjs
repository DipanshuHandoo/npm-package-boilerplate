import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
export const readPackage = () => readJson(path.join(root, "package.json"));
export const readConfig = () => readJson(path.join(root, "boilerplate.config.json"));

export const sourceExtension = () => (readConfig().language === "js" ? "js" : "ts");

export const log = (message) => console.log(`\n> ${message}`);

export function binPath(packageName, binName = packageName) {
  const pkgDir = path.join(root, "node_modules", ...packageName.split("/"));
  const manifest = readJson(path.join(pkgDir, "package.json"));
  const rel = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];
  if (!rel) throw new Error(`Package "${packageName}" does not expose a "${binName}" binary`);
  return path.join(pkgDir, rel);
}

/** Runs a command without a shell; rejects on a non-zero exit so callers fail fast. */
export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

export const runNode = (args, options) => run(process.execPath, args, options);

export const runBin = (packageName, binName, args = [], options) =>
  runNode([binPath(packageName, binName), ...args], options);

/** Captures output instead of inheriting stdio. Never rejects on a non-zero exit. */
export function capture(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

/** Resolves npm without a shell so paths with spaces and Windows .cmd shims are safe. */
export function npmInvocation(args) {
  const execPath = process.env.npm_execpath;
  if (execPath && /npm-cli\.c?js$/.test(execPath) && existsSync(execPath)) {
    return { command: process.execPath, args: [execPath, ...args], options: {} };
  }
  const bundled = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (existsSync(bundled))
    return { command: process.execPath, args: [bundled, ...args], options: {} };
  return { command: "npm", args, options: { shell: process.platform === "win32" } };
}

export function runNpm(args, options = {}) {
  const inv = npmInvocation(args);
  return run(inv.command, inv.args, { ...inv.options, ...options });
}

export function captureNpm(args, options = {}) {
  const inv = npmInvocation(args);
  return capture(inv.command, inv.args, { ...inv.options, ...options });
}

export function fail(error) {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
