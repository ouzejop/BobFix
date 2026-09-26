#!/usr/bin/env node
/**
 * BobFix Universal Setup Script
 * Cross-platform installation and environment check (Windows / Linux / macOS).
 *
 * Usage:
 *   node scripts/setup.mjs [--global]
 */

import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, symlinkSync, rmSync } from "node:fs";
import { platform, homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const isWin = platform() === "win32";
const args = process.argv.slice(2);
const installGlobal = args.includes("--global");

console.log("\n========================================================");
console.log(" 🚀 BobFix Universal Setup & Environment Verification");
console.log("========================================================\n");

// 1. Check Node Version
const nodeVersion = process.versions.node;
const major = parseInt(nodeVersion.split(".")[0], 10);
console.log(`[1/5] Checking Node.js environment...`);
console.log(`      Node version: v${nodeVersion} (${platform()} ${process.arch})`);
if (major < 20) {
  console.error(`      ⚠️ Warning: Node 20+ is recommended. Detected v${nodeVersion}.`);
} else {
  console.log(`      ✓ Node.js version is compatible.`);
}

// 2. Check Git
console.log(`\n[2/5] Checking Git availability...`);
try {
  const gitVer = execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
  console.log(`      ✓ Git detected: ${gitVer}`);
} catch (err) {
  console.error(`      ❌ Error: Git is not installed or not in PATH.`);
  process.exit(1);
}

// 3. Install demo-app dependencies cleanly
console.log(`\n[3/5] Installing application dependencies...`);
console.log(`      Running 'npm install --ignore-scripts' in demo-app...`);
const npmCmd = isWin ? "npm.cmd" : "npm";
const npmInstall = spawnSync(npmCmd, ["install", "--ignore-scripts"], {
  cwd: join(root, "demo-app"),
  encoding: "utf8",
  shell: isWin,
});

if (npmInstall.status !== 0) {
  console.error(`      ❌ Dependency installation failed:`);
  console.error(npmInstall.stderr || npmInstall.stdout);
  process.exit(1);
}
console.log(`      ✓ Dependencies installed successfully without native build bottlenecks.`);

// 4. Ensure Skill Multi-IDE Compatibility (.bob and .agents)
console.log(`\n[4/5] Configuring agent skill paths...`);
const srcSkillsDir = join(root, ".bob", "skills");
const agentSkillsDir = join(root, ".agents", "skills");

if (existsSync(srcSkillsDir)) {
  mkdirSync(agentSkillsDir, { recursive: true });
  const skills = ["bobfix-investigate", "bobfix-fix"];
  for (const sk of skills) {
    const src = join(srcSkillsDir, sk);
    const dst = join(agentSkillsDir, sk);
    if (existsSync(src)) {
      rmSync(dst, { recursive: true, force: true });
      cpSync(src, dst, { recursive: true });
      console.log(`      ✓ Linked skill '${sk}' to .agents/skills/${sk}`);
    }
  }
}

// Optional Global install
if (installGlobal) {
  console.log(`\n      Configuring global skill installations...`);
  const globalRoots = [
    join(homedir(), ".gemini", "config", "skills"),
    join(homedir(), ".bob", "skills")
  ];
  for (const gRoot of globalRoots) {
    try {
      mkdirSync(gRoot, { recursive: true });
      for (const sk of ["bobfix-investigate", "bobfix-fix"]) {
        const src = join(srcSkillsDir, sk);
        const dst = join(gRoot, sk);
        rmSync(dst, { recursive: true, force: true });
        cpSync(src, dst, { recursive: true });
      }
      console.log(`      ✓ Installed skills globally in ${gRoot}`);
    } catch (e) {
      console.log(`      ⚠️ Could not write to ${gRoot} (${e.message})`);
    }
  }
}

// 5. Smoke Test (Vitest Runner & Database Adapter)
console.log(`\n[5/5] Running environment smoke test...`);
const npxCmd = isWin ? "npx.cmd" : "npx";
const smoke = spawnSync(npxCmd, ["vitest", "run", "tests/auth.test.ts"], {
  cwd: join(root, "demo-app", "api"),
  encoding: "utf8",
  shell: isWin,
});

if (smoke.status === 0) {
  console.log(`      ✓ Smoke test passed: Test runner and SQLite adapter are functional!`);
} else {
  console.log(`      ⚠️ Smoke test finished with code ${smoke.status}. Output:`);
  console.log(smoke.stdout?.slice(0, 300) || smoke.stderr?.slice(0, 300));
}

console.log("\n========================================================");
console.log(" 🎉 BobFix Setup Complete!");
console.log("========================================================");
console.log(`
You can now run BobFix in any environment:

  1. In IBM Bob IDE:
     - Mode 'BobFix Investigator' : Reproduce & Triangulate
     - Mode 'BobFix Fixer'        : Patch & Verify

  2. In Terminal / CI:
     - Run verification : npm run verify -- --run <id> --base <base-sha> --test <test-path>
     - Run api tests    : npm test

`);
