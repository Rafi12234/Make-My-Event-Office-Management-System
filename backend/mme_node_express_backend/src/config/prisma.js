import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

// All primary/foreign keys are BigInt (MySQL BIGINT UNSIGNED). Native
// JSON.stringify() cannot serialize BigInt values and throws. Every id in
// this app safely fits within Number.MAX_SAFE_INTEGER, so converting to a
// plain number for JSON responses (res.json) is safe and keeps API response
// shapes identical to the old mysql2-based responses (which returned plain
// numbers).
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function () {
  return Number(this);
};

// Prisma 7 requires an explicit driver adapter to connect to MySQL/MariaDB
// (it no longer ships a built-in query engine binary for direct connections).
// This adapter wraps the "mariadb" driver internally and manages its own
// connection pool, same role the old mysql2 `pool` used to play.
const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

// Single shared Prisma Client instance for the whole app (recommended by
// Prisma docs — avoids exhausting the MySQL connection pool by creating a
// new client per request).
export const prisma = new PrismaClient({ adapter });

export async function verifyDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("MySQL database connected successfully (Prisma).");
}
