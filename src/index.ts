import { initDb } from './db';
import { AuthService } from './auth';
import { IngestionService } from './ingestion';
import { config } from './config';
import readline from 'readline';

async function main() {
  initDb();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('QBO Ingestion Service Started');
  console.log('-----------------------------');

  // Check if we have any realms authorized
  const realms = AuthService.getAllRealmIds();
  if (realms.length === 0) {
    console.log('No authorized companies found.');
    console.log('Please authorize a company using the OAuth Playground.');
    console.log(`Redirect URI: ${config.redirectUri}`);
    
    rl.question('Enter Realm ID: ', (realmId) => {
      rl.question('Enter Authorization Code: ', async (code) => {
        try {
          console.log('Exchanging code for tokens...');
          await AuthService.exchangeCodeForTokens(code, realmId);
          console.log('Authorization successful!');
          startSyncLoop();
        } catch (error) {
          console.error('Authorization failed.');
          process.exit(1);
        }
        rl.close();
      });
    });
  } else {
    console.log(`Found ${realms.length} authorized companies: ${realms.join(', ')}`);
    console.log('Starting sync loop...');
    rl.close();
    startSyncLoop();
  }
}

async function startSyncLoop() {
  const syncInterval = 5 * 60 * 1000; // 5 minutes

  const runSync = async () => {
    const realms = AuthService.getAllRealmIds();
    for (const realmId of realms) {
      console.log(`\n--- Syncing Realm: ${realmId} ---`);
      await IngestionService.syncObject(realmId, 'Customer');
      await IngestionService.syncObject(realmId, 'Invoice');
    }
    console.log(`\nSync cycle complete. Next sync in ${syncInterval / 1000} seconds.`);
  };

  // Run immediately
  await runSync();

  // Schedule
  setInterval(runSync, syncInterval);
}

main().catch(console.error);
