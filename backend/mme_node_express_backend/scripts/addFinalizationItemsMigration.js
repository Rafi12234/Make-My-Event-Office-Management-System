// One-off: creates client_finalization_items / client_finalization_images
// (see database/add_finalization_items_migration.sql).
// Run once with: node scripts/addFinalizationItemsMigration.js
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

const existing = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) AS count FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'client_finalization_items'`,
);

if (Number(existing[0].count) > 0) {
  console.log("client_finalization_items already exists — nothing to do.");
  process.exit(0);
}

await prisma.$executeRawUnsafe(`
  CREATE TABLE client_finalization_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    finalization_id BIGINT UNSIGNED NOT NULL,
    item_key VARCHAR(80) NOT NULL,
    custom_label VARCHAR(160) NULL,
    description TEXT NULL,
    quantity INT UNSIGNED NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_finalization_items_finalization (finalization_id),
    CONSTRAINT fk_finalization_items_finalization FOREIGN KEY (finalization_id)
      REFERENCES client_finalizations (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

await prisma.$executeRawUnsafe(`
  CREATE TABLE client_finalization_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    finalization_item_id BIGINT UNSIGNED NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255) NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size_bytes INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_finalization_images_item (finalization_item_id),
    CONSTRAINT fk_finalization_images_item FOREIGN KEY (finalization_item_id)
      REFERENCES client_finalization_items (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

console.log("client_finalization_items / client_finalization_images created.");
process.exit(0);
