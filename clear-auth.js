// Simple script to clear auth tokens from the database
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || 'qbo_ingestion.db';

try {
  const db = new Database(dbPath);

  console.log('Current auth tokens:');
  const tokens = db.prepare('SELECT realm_id FROM auth_tokens').all();
  tokens.forEach(t => console.log(`  - ${t.realm_id}`));

  console.log('\nClearing all auth tokens...');
  db.prepare('DELETE FROM auth_tokens').run();

  console.log('✓ All auth tokens cleared!');
  console.log('Restart the application to re-authorize.');

  db.close();
} catch (error) {
  console.error('Error:', error.message);
  console.log('\nDatabase might not exist yet. Just run the application to create it.');
}
