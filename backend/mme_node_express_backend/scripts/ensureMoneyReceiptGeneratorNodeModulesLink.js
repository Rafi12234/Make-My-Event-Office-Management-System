// Ensures MoneyReceiptGenerator/backend/node_modules resolves to THIS
// project's real node_modules, so files under MoneyReceiptGenerator/backend
// (services/, routes/, controllers/) can `import "pdf-lib"`/`"express"`
// even though they physically live outside this npm project. Same
// gotcha/fix as ensurePdfGeneratorNodeModulesLink.js.
//
// Wired into this project's `postinstall` (see package.json) so a fresh
// `npm install` always recreates it, since node_modules itself is
// gitignored and rebuilt from scratch each time. Idempotent: safe to run
// repeatedly.
import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, "../node_modules");
const linkPath = path.resolve(__dirname, "../../../MoneyReceiptGenerator/backend/node_modules");

if (existsSync(linkPath)) {
  if (lstatSync(linkPath).isSymbolicLink()) {
    console.log("MoneyReceiptGenerator/backend/node_modules link already exists — nothing to do.");
  } else {
    console.warn(
      "MoneyReceiptGenerator/backend/node_modules exists and is not a link — leaving it alone.",
    );
  }
  process.exit(0);
}

mkdirSync(path.dirname(linkPath), { recursive: true });
symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
console.log(`Linked MoneyReceiptGenerator/backend/node_modules -> ${target}`);
