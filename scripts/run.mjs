import { runBin, fail } from "./lib/util.mjs";

// Usage: node scripts/run.mjs --bin <package> <binName> [args...]
const [flag, packageName, binName, ...args] = process.argv.slice(2);

if (flag !== "--bin" || !packageName || !binName) {
  fail("Usage: node scripts/run.mjs --bin <package> <binName> [args...]");
} else {
  runBin(packageName, binName, args).catch(() => {
    process.exitCode = 1;
  });
}
