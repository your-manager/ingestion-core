import dotenv from 'dotenv';

dotenv.config();

export const config = {
  clientId: process.env.QBO_CLIENT_ID || '',
  clientSecret: process.env.QBO_CLIENT_SECRET || '',
  environment: process.env.QBO_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
  redirectUri: process.env.QBO_REDIRECT_URI || 'http://localhost:3000/callback',
  dbPath: process.env.DB_PATH || 'qbo_ingestion.db',
};
