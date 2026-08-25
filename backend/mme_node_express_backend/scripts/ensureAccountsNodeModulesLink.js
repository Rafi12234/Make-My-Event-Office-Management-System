// Ensures Accounts/backend/node_modules resolves to THIS project's real
// node_modules, so files under Accounts/backend (routes/accounts.js,
// controllers/accountsController.js) can `import "express"`/`"multer"`
// even though they physically live outside this npm project.
//
// Node's ESM/CJS resolver looks for node_modules by walking up from the
// IMPORTING file's own directory — Accounts/backend has no package.json/
// node_modules of its own, so without this link those bare-specifier
// imports fail with ERR_MODULE_NOT_FOUND. (There is a matching script in
// the frontend project that links Accounts/frontend/node_modules the same
// way, for react/lucide-react/react-router imports there.)
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
const linkPath = path.resolve(__dirname, "../../../Accounts/backend/node_modules");

if (existsSync(linkPath)) {
  if (lstatSync(linkPath).isSymbolicLink()) {
    console.log("Accounts/backend/node_modules link already exists — nothing to do.");
  } else {
    console.warn(
      "Accounts/backend/node_modules exists and is not a link — leaving it alone.",
    );
  }
  process.exit(0);
}

mkdirSync(path.dirname(linkPath), { recursive: true });
symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
console.log(`Linked Accounts/backend/node_modules -> ${target}`);
