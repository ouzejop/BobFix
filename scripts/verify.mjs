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
import { tmpdir, platform } from "node:os";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";

/** On Windows, directory symlinks require elevated privileges; use a junction instead. */
function linkDir(src, dst) {
  if (platform() === "win32") {
    spawnSync("cmd", ["/c", "mklink", "/J", dst, src], { encoding: "utf8" });
  } else {
    symlinkSync(src, dst, "dir");
  }
}
/** On Windows, junctions must be removed with rmdir before git worktree remove, otherwise git recursively deletes the target node_modules! */
function unlinkDir(dst) {
  if (platform() === "win32") {
    spawnSync("cmd", ["/c", "rmdir", dst], { encoding: "utf8" });
  } else {
    rmSync(dst, { force: true });
  }
}
/** Convert any backslashes to forward slashes (for vitest CLI on Windows). */
function toSlash(p) { return p.replace(/\\/g, "/"); }

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

// Frozen reproduction test written from the bug report before any diagnosis
// (.bobfix/runs/<run>/bug.json → repro_test: { path, sha256 }). Mandatory when present.
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
let repro = null;
try {
  repro = JSON.parse(readFileSync(join(runDir, "bug.json"), "utf8")).repro_test ?? null;
} catch {}
const reproIntact = repro ? existsSync(join(root, repro.path)) && sha(join(root, repro.path)) === repro.sha256 : null;

function vitest(cwd, testFile, label) {
  if (args.cmd) return generic(cwd, testFile, label);
  const report = join(scratch, `${label}.json`);
  const cliArgs = ["vitest", "run", "--reporter=json", `--outputFile=${report}`];
  if (testFile) cliArgs.push(testFile);
  const started = Date.now();
  const p = spawnSync("npx", cliArgs, { cwd, encoding: "utf8", shell: true, env: { ...process.env, CI: "1" } });
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

// Runner-agnostic mode: exit code only; crash-like logs are not counted as a test failure.
const CRASH = /(cannot find module|modulenotfounderror|no module named|syntaxerror|command not found|no tests? (found|ran|collected)|error: collection|failed to compile|cannot find package)/i;
function generic(cwd, testFile, label) {
  const started = Date.now();
  const p = spawnSync(`${args.cmd} ${testFile ?? ""}`, { cwd, shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
  const output = `${p.stdout ?? ""}${p.stderr ?? ""}`;
  writeFileSync(join(runDir, `${label}.txt`), output);
  const crashed = CRASH.test(output);
  return {
    exit_code: p.status,
    duration_ms: Date.now() - started,
    total: null,
    passed: p.status === 0 ? "all" : null,
    failed: p.status === 0 ? 0 : crashed ? null : "some",
    ran: !crashed,
    log: `${label}.txt`,
  };
}

// 1. Buggy commit + the new regression test → must fail
// --harness-files: comma-separated repo-root-relative paths to copy from HEAD into
// the base worktree so that environment/harness fixes reach the "before" run
// without touching application logic files.
const harnessFiles = args["harness-files"] ? args["harness-files"].split(",").map((s) => s.trim()).filter(Boolean) : [];

const wt = join(scratch, "base");
git("worktree", "add", "--detach", wt, baseSha);
let before;
let reproBefore = null;
try {
  const dest = join(wt, args.test);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(root, args.test), dest);
  if (repro && reproIntact) {
    const rdest = join(wt, repro.path);
    mkdirSync(dirname(rdest), { recursive: true });
    copyFileSync(join(root, repro.path), rdest);
  }
  // Copy harness-only files from HEAD into the base worktree (e.g. db adapter, vitest config).
  for (const hf of harnessFiles) {
    const hsrc = join(root, hf);
    const hdst = join(wt, hf);
    if (existsSync(hsrc)) {
      mkdirSync(dirname(hdst), { recursive: true });
      copyFileSync(hsrc, hdst);
    }
  }
  // link node_modules of every directory from the repo root down to the app (npm workspaces hoist them)
  const parts = appRel.split("/").filter((s) => s && s !== ".");
  const dirs = ["."].concat(parts.map((_, i) => parts.slice(0, i + 1).join("/")));
  for (const dir of dirs) {
    const src = join(root, dir, "node_modules");
    const dst = join(wt, dir, "node_modules");
    if (existsSync(src) && !existsSync(dst)) linkDir(src, dst);
  }
  before = vitest(join(wt, appRel), toSlash(relative(appRel, args.test)), "before");
  if (repro && reproIntact) reproBefore = vitest(join(wt, appRel), toSlash(relative(appRel, repro.path)), "repro-before");
} finally {
  const parts = appRel.split("/").filter((s) => s && s !== ".");
  const dirs = ["."].concat(parts.map((_, i) => parts.slice(0, i + 1).join("/")));
  for (const dir of dirs) {
    const dst = join(wt, dir, "node_modules");
    if (existsSync(dst)) unlinkDir(dst);
  }
  git("worktree", "remove", "--force", wt);
}

// 2. Fixed commit, regression test alone → must pass
const after = vitest(join(root, appRel), toSlash(relative(appRel, args.test)), "after");
const reproAfter = repro && reproIntact ? vitest(join(root, appRel), toSlash(relative(appRel, repro.path)), "repro-after") : null;
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
  bug_reproduced_before_fix: before.ran && before.exit_code !== 0 && before.failed !== 0,
  regression_test_passes_after_fix: after.ran && after.exit_code === 0 && after.failed === 0,
  full_suite_passes: suite.ran && suite.exit_code === 0 && suite.failed === 0,
  build_ok: build.skipped || build.ok,
};
if (repro) {
  checks.repro_test_unmodified = reproIntact === true;
  checks.repro_fails_before_fix = !!reproBefore && reproBefore.ran && reproBefore.exit_code !== 0 && reproBefore.failed !== 0;
  checks.repro_passes_after_fix = !!reproAfter && reproAfter.ran && reproAfter.exit_code === 0 && reproAfter.failed === 0;
}
const result = {
  run_id: args.run,
  runner: args.cmd ?? "vitest (json reporter)",
  base_ref: baseSha,
  fixed_ref: headSha,
  regression_test: args.test,
  verified_at: new Date().toISOString(),
  repro_test: repro,
  runs: { before, after, suite, build, repro_before: reproBefore, repro_after: reproAfter },
  checks,
  status: Object.values(checks).every(Boolean) ? "VERIFIED" : "NOT_VERIFIED",
};
writeFileSync(join(runDir, "verification.json"), JSON.stringify(result, null, 2) + "\n");
rmSync(scratch, { recursive: true, force: true });

const mark = (b) => (b ? "✓" : "✗");
console.log(`${mark(checks.bug_reproduced_before_fix)} Bug reproduced before fix   (${before.failed ?? "?"}/${before.total ?? "?"} failing)`);
console.log(`${mark(checks.regression_test_passes_after_fix)} Regression test after fix   (${after.passed ?? "?"}/${after.total ?? "?"} passing)`);
console.log(`${mark(checks.full_suite_passes)} Full suite                  (${suite.passed ?? "?"}/${suite.total ?? "?"} passing)`);
if (repro) {
  console.log(`${mark(checks.repro_test_unmodified)} Repro test unmodified       (${repro.path})`);
  console.log(`${mark(checks.repro_fails_before_fix)} Repro test fails before fix`);
  console.log(`${mark(checks.repro_passes_after_fix)} Repro test passes after fix`);
}
console.log(`${mark(checks.build_ok)} Build${build.skipped ? " (skipped)" : ""}`);
console.log(`\nSTATUS: ${result.status}`);
process.exit(result.status === "VERIFIED" ? 0 : 1);
