# QuickBooks Online Ingestion Service

This service ingests Customers and Invoices from QuickBooks Online (QBO) into a local SQLite database. It supports OAuth authentication, incremental syncing, and automatic token refreshing.

## Prerequisites

- Node.js (v14 or higher)
- A QuickBooks Online Developer Account
- A QBO App with `com.intuit.quickbooks.accounting` scope

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ingestion-core
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory with your QBO App credentials:
   ```env
   QBO_CLIENT_ID=your_client_id
   QBO_CLIENT_SECRET=your_client_secret
   QBO_ENVIRONMENT=sandbox
   QBO_REDIRECT_URI=https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl
   DB_PATH=qbo_ingestion.db
   ```
   *Note: The Redirect URI must match what is configured in your QBO App. For the OAuth Playground, use `https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl`.*

## Running the Service

1. **Build and Run**
   ```bash
   npx ts-node src/index.ts
   ```

2. **First-time Authorization**
   - Go to the [Intuit OAuth Playground](https://developer.intuit.com/app/developer/playground).
   - Select your App and the `com.intuit.quickbooks.accounting` scope.
   - Click "Get Authorization Code".
   - Authorize your sandbox company.
   - Copy the **Realm ID** and **Authorization Code** from the playground.
   - Paste them into the CLI prompt when asked.

3. **Ongoing Operation**
   - The service will perform an initial backfill of all Customers and Invoices.
   - It will then poll for updates every 5 minutes.
   - Tokens are automatically refreshed and stored in the database.
   - You can restart the service at any time; it will resume syncing from where it left off.

## Architecture

- **Database**: SQLite (`better-sqlite3`) is used for local storage.
  - `customers`: Stores raw Customer objects.
  - `invoices`: Stores raw Invoice objects.
  - `auth_tokens`: Stores OAuth tokens per Realm ID.
  - `sync_state`: Tracks the last sync timestamp and status for each object type.
- **Ingestion Logic**:
  - Uses the `LastUpdatedTime` field from QBO objects for incremental syncing.
  - Persists the raw JSON payload to ensure no data loss.
  - Handles pagination and API errors.
- **Resilience**:
  - Sync state is updated only after successful persistence.
  - Failures are logged, and the service retries on the next cycle.
  - Token expiration is handled automatically.

## Future Improvements

- **Web Interface**: Add a simple UI to view sync status and manage connections.
- **Webhooks**: Implement QBO Webhooks for real-time updates instead of polling.
- **Multiple Entities**: Expand support to other QBO objects (Payments, Items, etc.).
- **Better Error Handling**: Implement exponential backoff for API rate limits.
