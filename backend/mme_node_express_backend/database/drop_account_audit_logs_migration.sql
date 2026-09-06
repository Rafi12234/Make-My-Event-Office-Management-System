-- Drops account_audit_logs (see scripts/dropAccountAuditLogsMigration.js).
-- The Admin Accounts audit-trail feature was removed entirely — nothing
-- reads or writes this table anymore.
DROP TABLE IF EXISTS account_audit_logs;
