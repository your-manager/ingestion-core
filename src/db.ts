import Database from 'better-sqlite3';
import { config } from './config';

const db = new Database(config.dbPath);

export function initDb() {
  // Auth Tokens Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      realm_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      access_token_expires_at INTEGER NOT NULL,
      refresh_token_expires_at INTEGER NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Customers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT NOT NULL,
      realm_id TEXT NOT NULL,
      data JSON NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (id, realm_id)
    )
  `);

  // Invoices Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT NOT NULL,
      realm_id TEXT NOT NULL,
      customer_ref TEXT,
      data JSON NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (id, realm_id)
    )
  `);

  // Sync State Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      realm_id TEXT NOT NULL,
      object_type TEXT NOT NULL,
      last_sync_timestamp TEXT,
      last_successful_sync INTEGER,
      status TEXT,
      error_message TEXT,
      PRIMARY KEY (realm_id, object_type)
    )
  `);
  
  console.log('Database initialized');
}

export default db;
