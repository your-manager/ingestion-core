import axios from 'axios';
import db from './db';
import { config } from './config';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

export class AuthService {
  private static getBasicAuthHeader(): string {
    const credentials = `${config.clientId}:${config.clientSecret}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  static async exchangeCodeForTokens(code: string, realmId: string): Promise<void> {
    try {
      const response = await axios.post<TokenResponse>(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: config.redirectUri,
        }),
        {
          headers: {
            Authorization: this.getBasicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.saveTokens(realmId, response.data);
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
      throw error;
    }
  }

  static async refreshTokens(realmId: string): Promise<string> {
    const tokens = this.getTokens(realmId);
    if (!tokens) {
      throw new Error(`No tokens found for realmId: ${realmId}`);
    }

    try {
      const response = await axios.post<TokenResponse>(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
        }),
        {
          headers: {
            Authorization: this.getBasicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
    
      this.saveTokens(realmId, response.data);
      return response.data.access_token;
    } catch (error: any) {
      console.error('Error refreshing tokens:', error.response?.data || error.message);
      throw error;
    }
  }

  static saveTokens(realmId: string, tokenData: TokenResponse) {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpiresAt = now + tokenData.expires_in;
    const refreshTokenExpiresAt = now + tokenData.x_refresh_token_expires_in;

    const stmt = db.prepare(`
      INSERT INTO auth_tokens (realm_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(realm_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        access_token_expires_at = excluded.access_token_expires_at,
        refresh_token_expires_at = excluded.refresh_token_expires_at,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      realmId,
      tokenData.access_token,
      tokenData.refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      now
    );
    console.log(`Tokens saved for realmId: ${realmId}`);
  }

  static getTokens(realmId: string): { access_token: string; refresh_token: string; access_token_expires_at: number } | undefined {
    const stmt = db.prepare('SELECT access_token, refresh_token, access_token_expires_at FROM auth_tokens WHERE realm_id = ?');
    return stmt.get(realmId) as any;
  }

  static async getValidAccessToken(realmId: string): Promise<string> {
    const tokens = this.getTokens(realmId);
    if (!tokens) {
      throw new Error(`No tokens found for realmId: ${realmId}`);
    }

    const now = Math.floor(Date.now() / 1000);
    // Refresh if expiring in less than 5 minutes
    if (tokens.access_token_expires_at - now < 300) {
      console.log(`Access token for ${realmId} expiring soon, refreshing...`);
      return this.refreshTokens(realmId);
    }

    return tokens.access_token;
  }
  
  static getAllRealmIds(): string[] {
      const stmt = db.prepare('SELECT realm_id FROM auth_tokens');
      const rows = stmt.all() as { realm_id: string }[];
      return rows.map(row => row.realm_id);
  }
}
