import Database from 'better-sqlite3';
import { config } from './config';

const db = new Database(config.dbPath);

export function initDb() {
  // Auth Tokens Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      realm_id TEXT PRIMARY KEY NOT NULL CHECK(length(realm_id) > 0),
      access_token TEXT NOT NULL CHECK(length(access_token) > 0),
      refresh_token TEXT NOT NULL CHECK(length(refresh_token) > 0),
      access_token_expires_at INTEGER NOT NULL CHECK(access_token_expires_at > 0),
      refresh_token_expires_at INTEGER NOT NULL CHECK(refresh_token_expires_at > 0),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')) CHECK(updated_at > 0)
    )
  `);

  // Customers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT NOT NULL CHECK(length(id) > 0),
      realm_id TEXT NOT NULL CHECK(length(realm_id) > 0),
      data TEXT NOT NULL CHECK(length(data) > 0),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')) CHECK(updated_at > 0),
      PRIMARY KEY (id, realm_id)
    )
  `);

  // Invoices Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT NOT NULL CHECK(length(id) > 0),
      realm_id TEXT NOT NULL CHECK(length(realm_id) > 0),
      customer_ref TEXT CHECK(customer_ref IS NULL OR length(customer_ref) > 0),
      data TEXT NOT NULL CHECK(length(data) > 0),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')) CHECK(updated_at > 0),
      PRIMARY KEY (id, realm_id)
    )
  `);

  // Sync State Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      realm_id TEXT NOT NULL CHECK(length(realm_id) > 0),
      object_type TEXT NOT NULL CHECK(object_type IN ('Customer', 'Invoice')),
      last_successful_sync INTEGER CHECK(last_successful_sync IS NULL OR last_successful_sync > 0),
      last_sync_attempt INTEGER CHECK(last_sync_attempt IS NULL OR last_sync_attempt > 0),
      status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
      error_message TEXT,
      PRIMARY KEY (realm_id, object_type)
    )
  `);

  // Indexes (only add when needed for specific query patterns)
  // Currently no additional indexes needed - PRIMARY KEYs cover all queries

  // Future indexes to add when you build reporting/analytics:
  // db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_realm ON customers(realm_id)`);
  // db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_updated ON customers(updated_at)`);
  // db.exec(`CREATE INDEX IF NOT EXISTS idx_invoices_realm ON invoices(realm_id)`);
  // db.exec(`CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_ref, realm_id)`);
  // db.exec(`CREATE INDEX IF NOT EXISTS idx_invoices_updated ON invoices(updated_at)`);

  console.log('Database initialized');
}

export default db;
