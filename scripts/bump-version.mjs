// Pre-commit hook (`.githooks/pre-commit`): bump the patch version in
// `package.json` and `package-lock.json` unless this commit already changes
// it. The version is the one `Brand` shows, so every commit is told apart.
// The staged copy and the working copy are bumped separately: nothing that was
// left unstaged gets staged.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FILES = ["package.json", "package-lock.json"];

function git(args, { input, env } = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    input,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "ignore"],
  }).trimEnd();
}

function tryGit(args, options) {
  try {
    return git(args, options);
  } catch {
    return null;
  }
}

function versionOf(text) {
  try {
    return JSON.parse(text).version ?? null;
  } catch {
    return null;
  }
}

// npm writes both files as `JSON.stringify(…, null, 2)` plus a newline, so
// this changes the version lines and nothing else.
function withVersion(text, version) {
  const json = JSON.parse(text);
  json.version = version;
  if (json.packages?.[""]) json.packages[""].version = version;
  return JSON.stringify(json, null, 2) + "\n";
}

// `git commit --amend` compares against the amended commit's parent, or every
// amend would bump again. The hook `exec`s node, so the parent process is
// `git commit` itself. Best effort: `/proc` on Linux, `ps` elsewhere; neither
// = no amend detected.
function parentArgs() {
  try {
    return fs.readFileSync(`/proc/${process.ppid}/cmdline`, "utf8").split("\0");
  } catch {
    try {
      const ps = ["-o", "args=", "-p", String(process.ppid)];
      return execFileSync("ps", ps, { encoding: "utf8" }).trim().split(/\s+/);
    } catch {
      return [];
    }
  }
}

// The indexes to write. `git commit <paths>` commits from a temporary
// `next-index-*.lock` and afterwards keeps `index.lock` as the real index:
// both need the bump, or the index is left a version behind HEAD.
function indexes() {
  const current = process.env.GIT_INDEX_FILE;
  if (!current || !path.basename(current).startsWith("next-index-")) return [undefined];
  return [current, path.join(git(["rev-parse", "--absolute-git-dir"]), "index.lock")];
}

function setStaged(file, version, index) {
  const env = index ? { GIT_INDEX_FILE: index } : undefined;
  const entry = tryGit(["ls-files", "-s", "--", file], { env });
  if (!entry) return;
  const text = git(["show", `:${file}`], { env });
  if (versionOf(text) === version) return;
  const blob = git(["hash-object", "-w", "--stdin"], { input: withVersion(text, version) });
  git(["update-index", "--cacheinfo", `${entry.split(" ")[0]},${blob},${file}`], { env });
}

if (process.env.SKIP_VERSION_BUMP) process.exit(0);

const base = parentArgs().includes("--amend") ? "HEAD~1" : "HEAD";
const before = tryGit(["show", `${base}:package.json`]);
// First commit (or amending it): nothing to compare against.
if (before === null) process.exit(0);

const old = versionOf(before);
const staged = versionOf(git(["show", ":package.json"]));
let target = staged;
if (staged === old) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(old ?? "");
  if (!parts) {
    console.warn(`bump-version: "${old}" is not major.minor.patch, left alone.`);
    process.exit(0);
  }
  target = `${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`;
}

// A version set by hand in `package.json` only still reaches the lockfile.
for (const file of FILES) {
  const was = versionOf(tryGit(["show", `:${file}`]) ?? "");
  if (was === null || was === target) continue;
  for (const index of indexes()) setStaged(file, target, index);

  // The working copy follows only if it held the same version as the index; a
  // version edited there but not staged is the developer's, kept.
  const work = fs.readFileSync(file, "utf8");
  if (versionOf(work) === was) fs.writeFileSync(file, withVersion(work, target));
  else console.warn(`bump-version: ${file} has an unstaged version change, left alone.`);
}

if (target !== staged) console.log(`bump-version: ${old} -> ${target}`);
