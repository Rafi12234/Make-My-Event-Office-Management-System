// One-off: wipes ALL Accounts module transaction data (local dev DB only)
// so every employee's Accounts section and every vendor's ledger starts
// empty. Deletes child-before-parent to satisfy FK constraints (TRUNCATE
// fails with FKs present — see repo memory). Keeps Employee and Vendor
// rows themselves; only resets their balances to 0.
// Run with: node scripts/resetAccountsModuleData.js
import "dotenv/config";
import readline from "node:readline/promises";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/config/prisma.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  "This will permanently delete ALL Accounts module transactions (money received, expenses, expense items, audit logs) and reset all wallet/vendor balances to 0 in the LOCAL database. Type YES to continue: ",
);
rl.close();

if (answer.trim() !== "YES") {
  console.log("Aborted — no changes made.");
  process.exit(0);
}

const counts = await prisma.$transaction(async (tx) => {
  const auditLogs = await tx.accountAuditLog.deleteMany({});
  const expenseItems = await tx.accountExpenseItem.deleteMany({});
  const expenses = await tx.accountExpense.deleteMany({});
  const moneyReceived = await tx.accountMoneyReceived.deleteMany({});
  const wallets = await tx.accountWallet.updateMany({ data: { currentBalance: 0 } });
  const vendorBalances = await tx.vendorBalance.updateMany({ data: { currentBalance: 0 } });

  return { auditLogs, expenseItems, expenses, moneyReceived, wallets, vendorBalances };
});

console.log("Deleted:", {
  auditLogs: counts.auditLogs.count,
  expenseItems: counts.expenseItems.count,
  expenses: counts.expenses.count,
  moneyReceived: counts.moneyReceived.count,
});
console.log("Reset to 0:", {
  wallets: counts.wallets.count,
  vendorBalances: counts.vendorBalances.count,
});

const receiptsDir = path.resolve(process.cwd(), "../../Accounts/backend/uploads/expense-receipts");
try {
  const files = await fs.readdir(receiptsDir);
  await Promise.all(
    files
      .filter((name) => name !== ".gitkeep")
      .map((name) => fs.unlink(path.join(receiptsDir, name))),
  );
  console.log(`Removed ${files.filter((n) => n !== ".gitkeep").length} orphaned receipt file(s) from ${receiptsDir}`);
} catch (err) {
  console.log(`Skipped receipt file cleanup (${err.message})`);
}

console.log("Accounts module fully reset — every employee wallet and vendor balance is now 0, no transaction history remains.");
process.exit(0);
