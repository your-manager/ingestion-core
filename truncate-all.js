// Script to truncate all tables (remove all data but keep schema)
const Database = require('better-sqlite3');
const readline = require('readline');

const dbPath = process.env.DB_PATH || 'qbo_ingestion.db';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

try {
  const db = new Database(dbPath);

  console.log('⚠️  WARNING: This will delete ALL data from all tables!');
  console.log('This includes:');
  console.log('  - All authorized companies');
  console.log('  - All customers');
  console.log('  - All invoices');
  console.log('  - All sync state');
  console.log('');

  rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      db.close();
      rl.close();
      process.exit(0);
    }

    console.log('\nTruncating tables...');

    // Delete all data from all tables
    db.prepare('DELETE FROM auth_tokens').run();
    console.log('✓ Cleared auth_tokens');

    db.prepare('DELETE FROM customers').run();
    console.log('✓ Cleared customers');

    db.prepare('DELETE FROM invoices').run();
    console.log('✓ Cleared invoices');

    db.prepare('DELETE FROM sync_state').run();
    console.log('✓ Cleared sync_state');

    // Reset SQLite's internal row counter (optional)
    db.prepare('VACUUM').run();
    console.log('✓ Vacuumed database');

    console.log('\n✅ All tables truncated successfully!');
    console.log('The database schema is intact. You can now restart the application.');

    db.close();
    rl.close();
  });
} catch (error) {
  console.error('Error:', error.message);
  rl.close();
  process.exit(1);
}
