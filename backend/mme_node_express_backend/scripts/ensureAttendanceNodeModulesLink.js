// Ensures mobile/Attendance/backend/node_modules resolves to THIS project's
// real node_modules, so files under mobile/Attendance/backend
// (routes/attendance.js, controllers/attendanceController.js) can
// `import "express"` even though they physically live outside this npm
// project. Same gotcha/fix as ensureAccountsNodeModulesLink.js, just one
// level deeper (mobile/Attendance/backend instead of a repo-root sibling).
//
// Node's ESM/CJS resolver looks for node_modules by walking up from the
// IMPORTING file's own directory — mobile/Attendance/backend has no
// package.json/node_modules of its own, so without this link those bare-
// specifier imports fail with ERR_MODULE_NOT_FOUND.
//
// Wired into this project's `postinstall` (see package.json) so a fresh
// `npm install` — local reinstall, CI/CD deploy — always recreates it,
// since node_modules itself is gitignored and rebuilt from scratch each
// time. Idempotent: safe to run repeatedly.
import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, "../node_modules");
const linkPath = path.resolve(__dirname, "../../../mobile/Attendance/backend/node_modules");

if (existsSync(linkPath)) {
  if (lstatSync(linkPath).isSymbolicLink()) {
    console.log("mobile/Attendance/backend/node_modules link already exists — nothing to do.");
  } else {
    console.warn(
      "mobile/Attendance/backend/node_modules exists and is not a link — leaving it alone.",
    );
  }
  process.exit(0);
}

mkdirSync(path.dirname(linkPath), { recursive: true });
symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
console.log(`Linked mobile/Attendance/backend/node_modules -> ${target}`);
