import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const __filename =
  fileURLToPath(
    import.meta.url,
  );

const __dirname =
  path.dirname(
    __filename,
  );

const backendRoot =
  path.resolve(
    __dirname,
    "..",
  );

/*
|--------------------------------------------------------------------------
| Locate existing main backend
|--------------------------------------------------------------------------
|
| We only READ its .env.
| Nothing inside the existing website backend is modified.
|
*/

const mainBackendRoot =
  process.env
    .MAIN_BACKEND_ROOT
    ? path.resolve(
        process.env
          .MAIN_BACKEND_ROOT,
      )
    : path.resolve(
        backendRoot,
        "../../../backend/mme_node_express_backend",
      );

const mainEnvPath =
  path.join(
    mainBackendRoot,
    ".env",
  );

console.log(
  `[prisma] Loading environment from: ${mainEnvPath}`,
);

if (
  !fs.existsSync(
    mainEnvPath,
  )
) {
  console.error(
    "\n[prisma] Existing backend .env file was not found.",
  );

  console.error(
    `[prisma] Expected: ${mainEnvPath}`,
  );

  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| Load DATABASE_URL
|--------------------------------------------------------------------------
*/

dotenv.config({
  path: mainEnvPath,
});

if (
  !process.env
    .DATABASE_URL
) {
  console.error(
    "\n[prisma] DATABASE_URL was not found.",
  );

  console.error(
    `[prisma] Expected DATABASE_URL inside: ${mainEnvPath}`,
  );

  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| Locate Prisma schema
|--------------------------------------------------------------------------
*/

const schemaPath =
  path.join(
    backendRoot,
    "prisma",
    "schema.prisma",
  );

if (
  !fs.existsSync(
    schemaPath,
  )
) {
  console.error(
    "\n[prisma] schema.prisma was not found.",
  );

  console.error(
    `[prisma] Expected: ${schemaPath}`,
  );

  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| Run Prisma CLI
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Do NOT execute:
|
| node_modules/.bin/prisma.cmd
|
| directly on Windows.
|
| Node.js 22 can throw:
|
| spawnSync prisma.cmd EINVAL
|
| Instead, execute Prisma's JavaScript CLI through the current Node.js
| executable. This works on Windows without requiring shell=true.
|
*/

const prismaCliPath =
  path.join(
    backendRoot,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );

if (
  !fs.existsSync(
    prismaCliPath,
  )
) {
  console.error(
    "\n[prisma] Prisma CLI was not found.",
  );

  console.error(
    `[prisma] Expected: ${prismaCliPath}`,
  );

  console.error(
    "[prisma] Run npm install --ignore-scripts first.",
  );

  process.exit(1);
}

console.log(
  `[prisma] Schema: ${schemaPath}`,
);

console.log(
  "[prisma] Generating dedicated Financial API Prisma Client...",
);

const result =
  spawnSync(
    process.execPath,
    [
      prismaCliPath,
      "generate",
      "--schema",
      schemaPath,
    ],
    {
      cwd:
        backendRoot,

      env: {
        ...process.env,

        DATABASE_URL:
          process.env
            .DATABASE_URL,
      },

      stdio:
        "inherit",

      shell:
        false,
    },
  );

if (result.error) {
  console.error(
    "\n[prisma] Prisma generation failed:",
  );

  console.error(
    result.error,
  );

  process.exit(1);
}

if (
  result.status !== 0
) {
  console.error(
    `\n[prisma] Prisma exited with status ${result.status}.`,
  );

  process.exit(
    result.status || 1,
  );
}

console.log(
  "\n[prisma] Prisma Client generated successfully.",
);

process.exit(0);