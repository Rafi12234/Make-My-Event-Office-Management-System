import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const API_ORIGIN = process.env.VITE_API_ORIGIN || "http://localhost:5000";
const PROTECTED_PAGE_PREFIXES = ["/management", "/calendar", "/accounts"];

// Repo root — two levels up from this project (frontend/make my event
// office management system -> frontend -> repo root). Vite's own
// workspace-root auto-detection stops as soon as it finds a
// package-lock.json (which this project has), so it never reaches the
// repo root's .git on its own — added explicitly to server.fs.allow so
// files under Accounts/frontend (a sibling of this project, imported
// directly by App.jsx) can be served in dev instead of getting a 403.
const REPO_ROOT = path.resolve(process.cwd(), "../..");


// Mirrors the server-side page guard that lives in the Express backend
// (backend/mme_node_express_backend/src/server.js) so direct/refreshed
// requests for protected SPA routes get redirected to /login during
// `vite dev` too — not just in the production build served by Express.
// Delegates the actual session check to the backend (GET /api/employees/me)
// instead of duplicating JWT verification here, so there is a single
// source of truth for what counts as "logged in".
function serverSideAuthGuard() {
  return {
    name: "server-side-auth-guard",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [pathname] = (req.url || "").split("?");
        const isPageNavigation =
          req.method === "GET" &&
          (req.headers.accept || "").includes("text/html");
        const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
          (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        );

        if (!isPageNavigation || !isProtectedPage) {
          return next();
        }

        try {
          const response = await fetch(`${API_ORIGIN}/api/employees/me`, {
            headers: { cookie: req.headers.cookie || "" },
          });

          if (!response.ok) {
            res.writeHead(302, { Location: "/login" });
            return res.end();
          }
        } catch {
          // Backend unreachable — fail closed, same as an unauthenticated user.
          res.writeHead(302, { Location: "/login" });
          return res.end();
        }

        return next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serverSideAuthGuard()],
  server: {
    fs: {
      allow: [REPO_ROOT],
    },
  },
});