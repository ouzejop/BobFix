#!/usr/bin/env node
// BobFix verification — no AI involved.
// Proves a fix by checking, with the test runner's own results:
//   1. the regression test FAILS on the buggy commit (bug reproduced)
//   2. the regression test PASSES on the fixed commit
//   3. the full test suite PASSES on the fixed commit
//   4. (optional) the build succeeds
// Writes .bobfix/runs/<run>/verification.json
//
// Usage:
//   node scripts/verify.mjs --run <run-id> --base <buggy-ref> --test <path/from/repo/root>
//                           [--app <dir>] [--build "<cmd>"]
// --app defaults to "demo-app/api" (Vitest runs there).
// Assumes Vitest (reads its JSON reporter output).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
for (const k of ["run", "base", "test"]) {
  if (!args[k]) {
    console.error(`missing --${k}`);
    process.exit(2);
  }
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const root = git("rev-parse", "--show-toplevel");
const appRel = args.app ?? "demo-app/api";
const baseSha = git("rev-parse", args.base);
const headSha = git("rev-parse", "HEAD");
const runDir = join(root, ".bobfix", "runs", args.run);
mkdirSync(runDir, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "bobfix-"));

function vitest(cwd, testFile, label) {
  const report = join(scratch, `${label}.json`);
  const cliArgs = ["vitest", "run", "--reporter=json", `--outputFile=${report}`];
  if (testFile) cliArgs.push(testFile);
  const started = Date.now();
  const p = spawnSync("npx", cliArgs, { cwd, encoding: "utf8", env: { ...process.env, CI: "1" } });
  const output = `${p.stdout ?? ""}${p.stderr ?? ""}`;
  writeFileSync(join(runDir, `${label}.txt`), output);
  let r = null;
  try {
    r = JSON.parse(readFileSync(report, "utf8"));
  } catch {}
  return {
    exit_code: p.status,
    duration_ms: Date.now() - started,
    total: r?.numTotalTests ?? null,
    passed: r?.numPassedTests ?? null,
    failed: r?.numFailedTests ?? null,
    // true only when tests actually ran; a crash or missing file is not a "failure" of the test
    ran: r !== null && (r.numTotalTests ?? 0) > 0,
    log: `${label}.txt`,
  };
}

// 1. Buggy commit + the new regression test → must fail
const wt = join(scratch, "base");
git("worktree", "add", "--detach", wt, baseSha);
let before;
try {
  const dest = join(wt, args.test);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(root, args.test), dest);
  for (const dir of new Set([".", appRel])) {
    const src = join(root, dir, "node_modules");
    const dst = join(wt, dir, "node_modules");
    if (existsSync(src) && !existsSync(dst)) symlinkSync(src, dst, "dir");
  }
  before = vitest(join(wt, appRel), relative(appRel, args.test), "before");
} finally {
  git("worktree", "remove", "--force", wt);
}

// 2. Fixed commit, regression test alone → must pass
const after = vitest(join(root, appRel), relative(appRel, args.test), "after");
// 3. Fixed commit, full suite → must pass
const suite = vitest(join(root, appRel), null, "suite");
// 4. Optional build
let build = { skipped: true };
if (args.build) {
  const p = spawnSync(args.build, { cwd: join(root, appRel), shell: true, encoding: "utf8" });
  writeFileSync(join(runDir, "build.txt"), `${p.stdout ?? ""}${p.stderr ?? ""}`);
  build = { skipped: false, exit_code: p.status, ok: p.status === 0, log: "build.txt" };
}

const checks = {
  bug_reproduced_before_fix: before.ran && before.failed > 0,
  regression_test_passes_after_fix: after.ran && after.exit_code === 0 && after.failed === 0,
  full_suite_passes: suite.ran && suite.exit_code === 0 && suite.failed === 0,
  build_ok: build.skipped || build.ok,
};
const result = {
  run_id: args.run,
  base_ref: baseSha,
  fixed_ref: headSha,
  regression_test: args.test,
  verified_at: new Date().toISOString(),
  runs: { before, after, suite, build },
  checks,
  status: Object.values(checks).every(Boolean) ? "VERIFIED" : "NOT_VERIFIED",
};
writeFileSync(join(runDir, "verification.json"), JSON.stringify(result, null, 2) + "\n");
rmSync(scratch, { recursive: true, force: true });

const mark = (b) => (b ? "✓" : "✗");
console.log(`${mark(checks.bug_reproduced_before_fix)} Bug reproduced before fix   (${before.failed ?? "?"}/${before.total ?? "?"} failing)`);
console.log(`${mark(checks.regression_test_passes_after_fix)} Regression test after fix   (${after.passed ?? "?"}/${after.total ?? "?"} passing)`);
console.log(`${mark(checks.full_suite_passes)} Full suite                  (${suite.passed ?? "?"}/${suite.total ?? "?"} passing)`);
console.log(`${mark(checks.build_ok)} Build${build.skipped ? " (skipped)" : ""}`);
console.log(`\nSTATUS: ${result.status}`);
process.exit(result.status === "VERIFIED" ? 0 : 1);
