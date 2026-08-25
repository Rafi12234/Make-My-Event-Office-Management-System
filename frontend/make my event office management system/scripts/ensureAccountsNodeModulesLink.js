// Ensures Accounts/frontend/node_modules resolves to THIS project's real
// node_modules, so files under Accounts/frontend (pages/, components/,
// services/) can `import "react"` / `"react-router"` / `"lucide-react"`
// even though they physically live outside this npm project.
//
// Vite/Node's module resolver looks for node_modules by walking up from
// the IMPORTING file's own directory — Accounts/frontend has no
// package.json/node_modules of its own, so without this link those
// bare-specifier imports fail to resolve. (There is a matching script in
// the backend project that links Accounts/backend/node_modules the same
// way, for express/multer imports there.)
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
const linkPath = path.resolve(__dirname, "../../../Accounts/frontend/node_modules");

if (existsSync(linkPath)) {
  if (lstatSync(linkPath).isSymbolicLink()) {
    console.log("Accounts/frontend/node_modules link already exists — nothing to do.");
  } else {
    console.warn(
      "Accounts/frontend/node_modules exists and is not a link — leaving it alone.",
    );
  }
  process.exit(0);
}

mkdirSync(path.dirname(linkPath), { recursive: true });
symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
console.log(`Linked Accounts/frontend/node_modules -> ${target}`);
