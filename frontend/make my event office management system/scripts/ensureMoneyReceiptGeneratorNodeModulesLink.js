// Ensures MoneyReceiptGenerator/frontend/node_modules resolves to THIS
// project's real node_modules, so files under MoneyReceiptGenerator/frontend
// (pages/, components/, services/) can `import "react"`/`"lucide-react"`/
// `"react-router"` even though they physically live outside this npm
// project. Same idea as ensurePdfGeneratorNodeModulesLink.js.
//
// Wired into this project's `postinstall` so a fresh `npm install` always
// recreates it, since node_modules itself is gitignored and rebuilt from
// scratch each time. Idempotent: safe to run repeatedly.
import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, "../node_modules");
const linkPath = path.resolve(__dirname, "../../../MoneyReceiptGenerator/frontend/node_modules");

if (existsSync(linkPath)) {
  if (lstatSync(linkPath).isSymbolicLink()) {
    console.log("MoneyReceiptGenerator/frontend/node_modules link already exists — nothing to do.");
  } else {
    console.warn(
      "MoneyReceiptGenerator/frontend/node_modules exists and is not a link — leaving it alone.",
    );
  }
  process.exit(0);
}

mkdirSync(path.dirname(linkPath), { recursive: true });
symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
console.log(`Linked MoneyReceiptGenerator/frontend/node_modules -> ${target}`);
