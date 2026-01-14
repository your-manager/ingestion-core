import db from './db';
import { QboService } from './qbo';

export class IngestionService {
  static async syncObject(realmId: string, objectType: 'Customer' | 'Invoice') {
    console.log(`Starting sync for ${objectType} (Realm: ${realmId})`);
    
    try {
      // Get last sync state
      const syncState = this.getSyncState(realmId, objectType);
      const lastSyncTime = syncState?.last_sync_timestamp;

      // Fetch updates from QBO
      const objects = await QboService.fetchObjects(realmId, objectType, lastSyncTime);
      
      if (objects.length === 0) {
        console.log(`No updates found for ${objectType} (Realm: ${realmId})`);
        this.updateSyncState(realmId, objectType, lastSyncTime || null, 'success');
        return;
      }

      console.log(`Found ${objects.length} updates for ${objectType} (Realm: ${realmId})`);

      // Persist objects
      const tableName = objectType === 'Customer' ? 'customers' : 'invoices';
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
      const latestTimestamp = objects[objects.length - 1].MetaData.LastUpdatedTime;
      this.updateSyncState(realmId, objectType, latestTimestamp, 'success');
      
      console.log(`Successfully synced ${objects.length} ${objectType}s (Realm: ${realmId})`);

    } catch (error: any) {
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
    lastSyncTimestamp: string | null, 
    status: 'success' | 'failure',
    errorMessage?: string
  ) {
    const now = Math.floor(Date.now() / 1000);
    
    // If failure, we don't update the last_sync_timestamp so we can retry from the same point
    // If success, we update it. If lastSyncTimestamp is null (no new data), we keep the old one (handled by COALESCE in SQL or logic here)
    
    let query = `
      INSERT INTO sync_state (realm_id, object_type, last_sync_timestamp, last_successful_sync, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(realm_id, object_type) DO UPDATE SET
        status = excluded.status,
        error_message = excluded.error_message
    `;

    if (status === 'success') {
        query += `, last_successful_sync = excluded.last_successful_sync`;
        if (lastSyncTimestamp) {
            query += `, last_sync_timestamp = excluded.last_sync_timestamp`;
        }
    }

    const stmt = db.prepare(query);
    stmt.run(
      realmId, 
      objectType, 
      lastSyncTimestamp, 
      status === 'success' ? now : null, // This value is only used if inserted, but for updates we handle logic above. Actually for insert we need correct values.
      status, 
      errorMessage || null
    );
    
    // Correction: The ON CONFLICT logic above is a bit tricky with conditional updates. 
    // Let's simplify: Read, Modify, Write is safer or just use specific upsert logic.
    // But since we want to be robust, let's just do a proper UPSERT with logic.
    
    // Actually, let's rewrite the query to be simpler and handle the logic in the SQL or JS.
    // If success: update timestamp and last_successful_sync.
    // If failure: update status and error message only.
    
    if (status === 'success') {
        const upsertSuccess = db.prepare(`
            INSERT INTO sync_state (realm_id, object_type, last_sync_timestamp, last_successful_sync, status, error_message)
            VALUES (?, ?, ?, ?, 'success', NULL)
            ON CONFLICT(realm_id, object_type) DO UPDATE SET
              last_sync_timestamp = COALESCE(?, sync_state.last_sync_timestamp),
              last_successful_sync = ?,
              status = 'success',
              error_message = NULL
        `);
        upsertSuccess.run(realmId, objectType, lastSyncTimestamp, now, lastSyncTimestamp, now);
    } else {
        const upsertFailure = db.prepare(`
            INSERT INTO sync_state (realm_id, object_type, last_sync_timestamp, last_successful_sync, status, error_message)
            VALUES (?, ?, NULL, NULL, 'failure', ?)
            ON CONFLICT(realm_id, object_type) DO UPDATE SET
              status = 'failure',
              error_message = ?
        `);
        upsertFailure.run(realmId, objectType, errorMessage, errorMessage);
    }
  }
}
