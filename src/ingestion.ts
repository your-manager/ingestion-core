import db from './db';
import { QboService } from './qbo';

export class IngestionService {
  static async syncObject(realmId: string, objectType: 'Customer' | 'Invoice') {
    console.log(`Starting sync for ${objectType} (Realm: ${realmId})`);

    try {
      // Get last sync state
      const syncState = this.getSyncState(realmId, objectType);
      const lastSuccessfulSync = syncState?.last_successful_sync;

      // Fetch updates from QBO using the checkpoint timestamp
      const objects = await QboService.fetchObjects(realmId, objectType, lastSuccessfulSync);

      if (objects.length === 0) {
        console.log(`No updates found for ${objectType} (Realm: ${realmId})`);
        // No new data - update checkpoint to now to avoid re-querying same time range
        this.updateSyncState(realmId, objectType, null, 'success');
        return;
      }

      console.log(`Found ${objects.length} updates for ${objectType} (Realm: ${realmId})`);

      // Persist objects
      const tableName = objectType === 'Customer' ? 'customers' : 'invoices'; // TODO: Use this variable in the below sql queries
      const insertStmt = objectType === 'Customer'
        ? db.prepare(`
            INSERT INTO customers (id, realm_id, data, updated_at)
            VALUES (?, ?, ?, strftime('%s', 'now'))
            ON CONFLICT(id, realm_id) DO UPDATE SET
              data = excluded.data,
              updated_at = excluded.updated_at
          `)
        : db.prepare(`
            INSERT INTO invoices (id, realm_id, customer_ref, data, updated_at)
            VALUES (?, ?, ?, ?, strftime('%s', 'now'))
            ON CONFLICT(id, realm_id) DO UPDATE SET
              customer_ref = excluded.customer_ref,
              data = excluded.data,
              updated_at = excluded.updated_at
          `);

      const transaction = db.transaction((items: any[]) => {
        for (const item of items) {
          if (objectType === 'Customer') {
            insertStmt.run(item.Id, realmId, JSON.stringify(item));
          } else {
            insertStmt.run(item.Id, realmId, item.CustomerRef?.value, JSON.stringify(item));
          }
        }
      });

      transaction(objects);

      // Update sync state with the latest timestamp from the fetched objects
      // QBO returns objects ordered by LastUpdatedTime, so the last object has the latest time
      const latestTimestamp = new Date(objects[objects.length - 1].MetaData.LastUpdatedTime).getTime() / 1000;
      this.updateSyncState(realmId, objectType, Math.floor(latestTimestamp), 'success');

      console.log(`Successfully synced ${objects.length} ${objectType}s (Realm: ${realmId})`);

    } catch (error: any) {
      // TODO: Ensure that in case of failures, mySQL transaction is rolled back and data is not persisted + 2 retries are configured
      console.error(`Sync failed for ${objectType} (Realm: ${realmId}):`, error.message);
      this.updateSyncState(realmId, objectType, null, 'failure', error.message);
    }
  }

  private static getSyncState(realmId: string, objectType: string): any {
    const stmt = db.prepare('SELECT * FROM sync_state WHERE realm_id = ? AND object_type = ?');
    return stmt.get(realmId, objectType);
  }

  private static updateSyncState(
    realmId: string,
    objectType: string,
    lastSyncTimestamp: number | null,
    status: 'success' | 'failure',
    errorMessage?: string
  ) {
    const now = Math.floor(Date.now() / 1000);

    // Always update last_sync_attempt (on both success and failure)
    // On success: always update last_successful_sync (even if no new data, use current time to advance checkpoint)
    // On failure: preserve last_successful_sync for retry

    if (status === 'success') {
        const upsertSuccess = db.prepare(`
            INSERT INTO sync_state (realm_id, object_type, last_successful_sync, last_sync_attempt, status, error_message)
            VALUES (?, ?, ?, ?, 'success', NULL)
            ON CONFLICT(realm_id, object_type) DO UPDATE SET
              last_successful_sync = ?,
              last_sync_attempt = ?,
              status = 'success',
              error_message = NULL
        `);
        // Always update last_successful_sync on success
        // Use lastSyncTimestamp if provided (new data found), otherwise use now (no new data, advance checkpoint)
        const checkpoint = lastSyncTimestamp || now;
        upsertSuccess.run(realmId, objectType, checkpoint, now, checkpoint, now);
    } else {
        const upsertFailure = db.prepare(`
            INSERT INTO sync_state (realm_id, object_type, last_successful_sync, last_sync_attempt, status, error_message)
            VALUES (?, ?, NULL, ?, 'failure', ?)
            ON CONFLICT(realm_id, object_type) DO UPDATE SET
              last_sync_attempt = ?,
              status = 'failure',
              error_message = ?
        `);
        upsertFailure.run(realmId, objectType, now, errorMessage, now, errorMessage);
    }
  }
}
