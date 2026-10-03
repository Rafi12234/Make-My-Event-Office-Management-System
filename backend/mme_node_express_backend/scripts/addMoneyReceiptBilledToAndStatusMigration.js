import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

try {
  const billedToCheck = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'money_receipts'
      AND COLUMN_NAME = 'billed_to'
  `);

  const bookingStatusCheck = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'money_receipts'
      AND COLUMN_NAME = 'booking_status'
  `);

  const hasBilledTo =
    Number(billedToCheck[0].count) > 0;

  const hasBookingStatus =
    Number(bookingStatusCheck[0].count) > 0;

  if (!hasBilledTo) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE money_receipts
      ADD COLUMN billed_to VARCHAR(255) NULL
      AFTER client_address
    `);

    console.log(
      "money_receipts.billed_to added."
    );
  } else {
    console.log(
      "money_receipts.billed_to already exists."
    );
  }

  if (!hasBookingStatus) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE money_receipts
      ADD COLUMN booking_status
      ENUM('confirmed', 'not_confirmed')
      NOT NULL DEFAULT 'not_confirmed'
      AFTER booking_reference
    `);

    console.log(
      "money_receipts.booking_status added."
    );
  } else {
    console.log(
      "money_receipts.booking_status already exists."
    );
  }

  console.log(
    "Money Receipt production migration completed."
  );
} catch (error) {
  console.error(
    "Money Receipt migration failed:",
    error
  );

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}