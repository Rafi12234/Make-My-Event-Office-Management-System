// One-off: recomputes every vendor's stored current_balance from scratch,
// using the "paid" (+amount) / "to_pay" (-amount) rule, to correct any
// vendor_balances rows left stale by transient bugs/testing.
// Run once with: node scripts/recalculateVendorBalances.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const vendors = await prisma.vendor.findMany();

for (const vendor of vendors) {
  const items = await prisma.accountExpenseItem.findMany({ where: { vendorId: vendor.id } });
  const balance = items.reduce((sum, item) => {
    const delta = item.paymentStatus === "paid" ? Number(item.totalAmount) : -Number(item.totalAmount);
    return Math.round((sum + delta) * 100) / 100;
  }, 0);

  await prisma.vendorBalance.upsert({
    where: { vendorId: vendor.id },
    create: { vendorId: vendor.id, currentBalance: balance },
    update: { currentBalance: balance },
  });

  console.log(`${vendor.name}: ${balance}`);
}

process.exit(0);
