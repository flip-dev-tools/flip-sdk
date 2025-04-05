# Flip SDK

A lightweight, flexible SDK for interacting with the Feature Flipper service at [feature-flipper.com](https://feature-flipper.com).

[![npm version](https://img.shields.io/npm/v/@flip-dev/flip-sdk.svg)](https://www.npmjs.com/package/@flip-dev/flip-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Installation

Install the package using npm:

```bash
npm install @flip-dev/flip-sdk
```

Or using yarn:

```bash
yarn add @flip-dev/flip-sdk
```

## Quick Start

Here's a simple example to get you started:

```javascript
import { client } from '@flip-dev/flip-sdk';

// Initialize the client
const flipClient = client({
  apiKey: 'your-api-key', // Optional: can also use FLIP_API_KEY environment variable
  cache: false, // Optional: enable caching (default: false)
  defaultsFallback: false, // Optional: use default values when tenant not found (default: false)
});

// Check if a feature is enabled
async function checkFeature() {
  const isFeatureEnabled = await flipClient.isEnabled({
    flipperName: 'my-feature',
    tenantId: 'customer-123',
  });

  if (isFeatureEnabled) {
    // Feature is enabled for this tenant
    console.log('Feature is enabled!');
  } else {
    // Feature is disabled for this tenant
    console.log('Feature is disabled.');
  }
}

checkFeature();
```

## NextJS 15 Server Action Example

Here's how to use the Flip SDK in a Next.js 15 server action to conditionally render a new navbar:

```typescript
// app/actions.ts
'use server';

import { client } from '@flip-dev/flip-sdk';
import { cookies } from 'next/headers';

// Initialize the client once
const flipClient = client({
  apiKey: process.env.FLIP_API_KEY,
});

// Server action to check if the new navbar should be shown
export async function getNavbarVersion() {
  // Get the user or tenant ID (from cookies, session, etc.)
  const cookieStore = cookies();
  const tenantId = cookieStore.get('tenantId')?.value || 'default-tenant';

  try {
    const isNewNavEnabled = await flipClient.isEnabled({
      flipperName: 'new-nav-enabled',
      tenantId,
    });

    return {
      navVersion: isNewNavEnabled ? 'new' : 'classic',
      tenantId,
    };
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return {
      navVersion: 'classic', // Fall back to classic navbar on error
      tenantId,
      error: 'Failed to check feature flag',
    };
  }
}
```

```typescript
// app/layout.tsx
import { getNavbarVersion } from './actions';
import ClassicNavbar from '@/components/ClassicNavbar';
import NewNavbar from '@/components/NewNavbar';

export default async function RootLayout({ children }) {
  // Call the server action to determine which navbar to show
  const { navVersion, tenantId } = await getNavbarVersion();

  return (
    <html lang="en">
      <body>
        {navVersion === 'new' ? (
          <NewNavbar tenantId={tenantId} />
        ) : (
          <ClassicNavbar tenantId={tenantId} />
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
```

This approach keeps feature flag checking on the server, improving security by not exposing your API keys to the client and enhancing performance by avoiding client-side API calls.

## API Reference

### Creating a Client

```javascript
import { client } from '@flip-dev/flip-sdk';

const flipClient = client({
  apiKey?: string,       // API key for authenticating with the Feature Flipper service
  cache?: boolean,       // Enable caching of flipper data (default: false)
  defaultsFallback?: boolean // Use default values when tenant not found (default: false)
});
```

#### Options

- **apiKey** (optional): Your API key for the Feature Flipper service. If not provided, the client will look for the `FLIP_API_KEY` environment variable. API keys are scoped to a specific stage. API keys can be generated in the [Flip Settings](https://feature-flipper.com/settings) by admin users.
- **cache** (optional): When set to `true`, the client will cache flipper data for the previously requested tenant to reduce API calls. Default is `false`.
- **defaultsFallback** (optional): When set to `true`, the API will return default values for flippers when the specified tenant isn't found. Default is `false`.

### Client Methods

#### `loadFlipperData`

Fetches all flipper data for a specific tenant. There is no need to call this method unless you prefer to handle error states explicitly.
isEnabled and getStringList will automatically call this method if the cache is disabled or if the tenant is not found in the cache.

```javascript
const response = await flipClient.loadFlipperData({
  tenantId: 'customer-123',
});

if (response.status === 'success') {
  console.log('All flippers:', response.flipperData);
  console.log('Boolean flippers:', response.booleanFlippers);
  console.log('String list flippers:', response.stringListFlippers);
} else {
  console.error('Error:', response.error);
}
```

#### `isEnabled`

Checks if a specific boolean flipper is enabled for a tenant.

```javascript
const enabled = await flipClient.isEnabled({
  flipperName: 'my-feature',
  tenantId: 'customer-123',
});

// Returns true if the feature is enabled, false otherwise
```

#### `getStringList`

Retrieves string list values for a specific flipper and tenant.

```javascript
const values = await flipClient.getStringList({
  flipperName: 'allowed-countries',
  tenantId: 'customer-123',
});

// Returns an array of strings, or an empty array if the flipper doesn't exist
console.log(values); // Example: ['US', 'CA', 'UK']
```

### Response Types

The SDK exports these TypeScript types for working with responses:

- **LoadFlipperDataResponse**: Union type of success or error response
- **LoadFlipperDataSuccessResponse**: Success response with flipper data
- **LoadFlipperDataErrorResponse**: Error response with error message

## Advanced Usage

### Environment Variables

The SDK supports these environment variables:

- **FLIP_API_KEY**: Your API key (used if no key is provided to the client constructor)
- **FLIP_API_BASE_URL**: Override the default API URL (defaults to 'https://api.feature-flipper.com')

### Caching

When the cache option is enabled, the client will store flipper data for each tenant and reuse it for subsequent calls to `isEnabled` and `getStringList` for the same tenant. This reduces API calls but means your app won't get the latest flipper data until the cache is refreshed.

```javascript
// With caching enabled
const flipClient = client({ cache: true });

// First call fetches data from the API
await flipClient.isEnabled({ flipperName: 'feature-1', tenantId: 'tenant-1' });

// Subsequent calls for the same tenant use cached data
await flipClient.isEnabled({ flipperName: 'feature-2', tenantId: 'tenant-1' });
```

### Error Handling

The SDK handles errors gracefully:

- `isEnabled` returns `false` if the API call fails
- `getStringList` returns an empty array if the API call fails
- `loadFlipperData` returns an error response with status 'error'

```javascript
try {
  const result = await flipClient.loadFlipperData({ tenantId: 'customer-123' });
  if (result.status === 'error') {
    console.error('API error:', result.error);
  }
} catch (e) {
  console.error('Unexpected error:', e);
}
```

## Migrating from Previous Versions

When upgrading from older versions, note these changes:

- The SDK now uses ESM modules, requiring Node.js 14+

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Check out [Flip Documentation](https://feature-flipper.com/documentation) for more information.
