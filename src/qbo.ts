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
    lastSyncTime?: string
  ): Promise<any[]> {
    const accessToken = await AuthService.getValidAccessToken(realmId);
    const baseUrl = this.getBaseUrl(realmId);
    
    let query = `SELECT * FROM ${objectType}`;
    if (lastSyncTime) {
      // QBO uses ISO 8601 format for timestamps
      query += ` WHERE MetaData.LastUpdatedTime > '${lastSyncTime}'`;
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
        console.error(`Error fetching ${objectType} for realm ${realmId}:`, error.response?.data || error.message);
        throw error;
      }
    }

    return allResults;
  }
}
