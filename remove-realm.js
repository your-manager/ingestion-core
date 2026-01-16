// Script to remove a specific realm ID from the database
const Database = require('better-sqlite3');
const readline = require('readline');

const dbPath = process.env.DB_PATH || 'qbo_ingestion.db';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

try {
  const db = new Database(dbPath);

  console.log('Current authorized companies:');
  const tokens = db.prepare('SELECT realm_id FROM auth_tokens').all();

  if (tokens.length === 0) {
    console.log('  No companies authorized yet.');
    db.close();
    rl.close();
    process.exit(0);
  }

  tokens.forEach((t, index) => {
    console.log(`  ${index + 1}. ${t.realm_id}`);
  });

  rl.question('\nEnter Realm ID to remove (or press Enter to cancel): ', (realmId) => {
    const trimmedRealmId = realmId.trim();

    if (!trimmedRealmId) {
      console.log('Cancelled.');
      db.close();
      rl.close();
      process.exit(0);
    }

    // Check if realm exists
    const exists = db.prepare('SELECT realm_id FROM auth_tokens WHERE realm_id = ?').get(trimmedRealmId);

    if (!exists) {
      console.log(`✗ Realm ID ${trimmedRealmId} not found.`);
      db.close();
      rl.close();
      process.exit(1);
    }

    // Remove from auth_tokens
    db.prepare('DELETE FROM auth_tokens WHERE realm_id = ?').run(trimmedRealmId);

    // Remove from sync_state
    db.prepare('DELETE FROM sync_state WHERE realm_id = ?').run(trimmedRealmId);

    // Remove customers and invoices
    db.prepare('DELETE FROM customers WHERE realm_id = ?').run(trimmedRealmId);
    db.prepare('DELETE FROM invoices WHERE realm_id = ?').run(trimmedRealmId);

    console.log(`✓ Removed Realm ID ${trimmedRealmId} and all associated data.`);
    console.log('You can now re-authorize this company by restarting the application.');

    db.close();
    rl.close();
  });
} catch (error) {
  console.error('Error:', error.message);
  rl.close();
  process.exit(1);
}
