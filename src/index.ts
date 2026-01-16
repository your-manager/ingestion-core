import { initDb } from './db';
import { AuthService } from './auth';
import { IngestionService } from './ingestion';
import { config } from './config';
import readline from 'readline';

async function promptForAuthorization(rl: readline.Interface): Promise<void> {
  return new Promise((resolve) => {
    console.log('\n=== Authorize QuickBooks Company ===');
    console.log('Please use the QuickBooks OAuth Playground to get these values:');
    console.log(`Redirect URI: ${config.redirectUri}`);
    console.log('\nIMPORTANT:');
    console.log('  - Realm ID: Your QuickBooks Company ID (usually numeric, e.g., "123456789")');
    console.log('  - Authorization Code: The temporary OAuth code from the redirect URL');
    console.log('  - These are TWO DIFFERENT values!\n');

    const askForCredentials = () => {
      rl.question('Enter Realm ID (Company ID): ', (realmId) => {
        const trimmedRealmId = realmId.trim();

        if (!trimmedRealmId) {
          console.error('✗ Realm ID cannot be empty. Please try again.');
          askForCredentials();
          return;
        }

        rl.question('Enter Authorization Code: ', async (code) => {
          const trimmedCode = code.trim();

          if (!trimmedCode) {
            console.error('✗ Authorization Code cannot be empty. Please try again.');
            askForCredentials();
            return;
          }

          if (trimmedRealmId === trimmedCode) {
            console.error('✗ Warning: Realm ID and Authorization Code are identical!');
            console.error('  This is usually incorrect. They should be different values.');
            rl.question('  Continue anyway? (y/n): ', async (confirm) => {
              if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
                askForCredentials();
                return;
              }
              await attemptAuthorization(trimmedCode, trimmedRealmId);
            });
            return;
          }

          await attemptAuthorization(trimmedCode, trimmedRealmId);
        });
      });
    };

    const attemptAuthorization = async (code: string, realmId: string) => {
      // Check if this realm ID is already registered
      const existingRealms = AuthService.getAllRealmIds();
      if (existingRealms.includes(realmId)) {
        console.error(`✗ Realm ID ${realmId} is already registered!`);
        console.error('  This company is already authorized. Skipping...\n');

        rl.question('Would you like to try a different company? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            askForCredentials(); // Try again with different credentials
          } else {
            resolve(); // Continue without adding
          }
        });
        return;
      }

      try {
        console.log('Exchanging code for tokens...');
        await AuthService.exchangeCodeForTokens(code, realmId);
        console.log('✓ Authorization successful!');
        console.log(`✓ Company authorized with Realm ID: ${realmId}\n`);
        resolve();
      } catch (error: any) {
        console.error(`✗ Authorization failed: ${error.response?.data?.error_description || error.message || error}`);

        rl.question('\nWould you like to retry? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            askForCredentials(); // Retry
          } else {
            console.log('Exiting...');
            rl.close();
            process.exit(1);
          }
        });
      }
    };

    askForCredentials();
  });
}

async function promptToAddCompany(rl: readline.Interface): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question('\nWould you like to authorize another company? (y/n): ', (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  initDb();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('QBO Ingestion Service Started');
  console.log('-----------------------------');

  // Check if we have any realms authorized
  let realms = AuthService.getAllRealmIds();

  if (realms.length === 0) {
    // No companies authorized yet - must authorize at least one
    await promptForAuthorization(rl);
    realms = AuthService.getAllRealmIds();
  } else {
    // Display existing companies
    console.log(`\nFound ${realms.length} authorized company(ies):`);
    realms.forEach((realmId, index) => {
      console.log(`  ${index + 1}. Realm ID: ${realmId}`);
    });
  }

  // Keep asking if user wants to add more companies until they say no
  let shouldAddMore = await promptToAddCompany(rl);

  while (shouldAddMore) {
    await promptForAuthorization(rl);

    // Refresh the list of realms
    realms = AuthService.getAllRealmIds();
    console.log(`\nYou now have ${realms.length} authorized company(ies):`);
    realms.forEach((realmId, index) => {
      console.log(`  ${index + 1}. Realm ID: ${realmId}`);
    });

    // Ask again
    shouldAddMore = await promptToAddCompany(rl);
  }

  console.log('\nStarting sync loop...');
  rl.close();
  startSyncLoop();
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
