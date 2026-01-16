import axios from 'axios';
import { AuthService } from './auth';
import { config } from './config';

export class QboService {
  private static getBaseUrl(realmId: string): string {
    const baseUrl = config.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    return `${baseUrl}/v3/company/${realmId}`;
  }

  static async fetchObjects(
    realmId: string,
    objectType: 'Customer' | 'Invoice',
    lastSyncTime?: number
  ): Promise<any[]> {
    const accessToken = await AuthService.getValidAccessToken(realmId);
    const baseUrl = this.getBaseUrl(realmId);

    let query = `SELECT * FROM ${objectType}`;
    if (lastSyncTime) {
      // Convert Unix timestamp (seconds) to ISO 8601 format that QBO expects
      const date = new Date(lastSyncTime * 1000); // Convert to milliseconds
      const isoDate = date.toISOString();
      query += ` WHERE MetaData.LastUpdatedTime > '${isoDate}'`;
    }
    // Order by LastUpdatedTime to ensure we process in order
    query += ` ORDERBY MetaData.LastUpdatedTime`;

    // Pagination
    let startPosition = 1;
    const maxResults = 1000;
    let allResults: any[] = [];
    let hasMore = true;

    while (hasMore) {
      const paginatedQuery = `${query} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      
      try {
        const response = await axios.get(`${baseUrl}/query`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          params: {
            query: paginatedQuery,
          },
        });

        const queryResponse = response.data.QueryResponse;
        const results = queryResponse[objectType] || [];
        
        allResults = allResults.concat(results);
        
        if (results.length < maxResults) {
          hasMore = false;
        } else {
          startPosition += maxResults;
        }
      } catch (error: any) {
        const errorDetails = error.response?.data || error.message;
        console.error(`Error fetching ${objectType} for realm ${realmId}:`);
        console.error('  Status:', error.response?.status);
        console.error('  Details:', JSON.stringify(errorDetails, null, 2));
        throw error;
      }
    }

    return allResults;
  }
}
