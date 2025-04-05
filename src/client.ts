interface Flipper {
  name: string;
  tenantId: string;
  type: 'boolean' | 'stringList';
  enabled?: boolean;
  values?: string[];
  isDefault: boolean;
}

interface Client {
  flipperData: Flipper[];
  loadFlipperData: ({ tenantId }: { tenantId: string }) => Promise<LoadFlipperDataResponse>;
  isEnabled: ({ flipperName, tenantId }: { flipperName: string; tenantId: string }) => Promise<boolean>;
  getStringList: ({ flipperName, tenantId }: { flipperName: string; tenantId: string }) => Promise<string[]>;
}

type LoadFlipperDataResponse =
  | {
      flipperData: Flipper[];
      status: 'success';
      booleanFlippers: Map<string, Flipper>;
      stringListFlippers: Map<string, Flipper>;
    }
  | {
      status: 'error';
      error: string;
    };

const client = ({
  apiKey,
  cache = false,
  defaultsFallback = false,
}: {
  apiKey?: string;
  cache?: boolean;
  defaultsFallback?: boolean;
}): Client => {
  let cachedBooleanFlippers = new Map<string, Flipper>();
  let cachedStringListFlippers = new Map<string, Flipper>();
  let cachedTenantId: string | null = null;
  let flipperData: Flipper[] = [];

  const baseUrl = process.env.FLIP_API_BASE_URL ?? 'https://api.feature-flipper.com';
  const key = apiKey || process.env.FLIP_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('process.env.FLIP_API_KEY is not set, and no API Key was provided');
  }

  const headers = {
    'x-api-key': key,
  };

  const loadFlipperData = async ({ tenantId }: { tenantId: string }): Promise<LoadFlipperDataResponse> => {
    try {
      const booleanFlippers = new Map<string, Flipper>();
      const stringListFlippers = new Map<string, Flipper>();
      const encodedTenantId = encodeURIComponent(tenantId);
      const response = await fetch(`${baseUrl}/flippers/${encodedTenantId}?defaultsFallback=${defaultsFallback}`, {
        headers,
      });

      if (!response.ok) {
        console.error(`Failed to fetch flippers for tenant ${tenantId}`);
        return { status: 'error', error: 'Failed to fetch flippers' };
      }

      const body = await response.json();
      body.data.forEach((flipper: any) => {
        if (flipper.type === 'boolean') {
          booleanFlippers.set(flipper.name, flipper);
        } else if (flipper.type === 'stringList') {
          stringListFlippers.set(flipper.name, flipper);
        }
      });

      if (cache) {
        cachedTenantId = tenantId;
        flipperData = body.data;
        cachedBooleanFlippers = booleanFlippers;
        cachedStringListFlippers = stringListFlippers;
      }

      return { flipperData: body.data, status: 'success', booleanFlippers, stringListFlippers };
    } catch (error) {
      console.error(`Failed to fetch flippers for tenant ${tenantId}, ${error}`);
      return { status: 'error', error: 'Failed to fetch flippers' };
    }
  };

  const isEnabled = async ({ flipperName, tenantId }: { flipperName: string; tenantId: string }) => {
    if (cache && cachedTenantId === tenantId && cachedBooleanFlippers.size > 0) {
      return cachedBooleanFlippers.get(flipperName)?.enabled ?? false;
    }
    const response = await loadFlipperData({ tenantId });
    if (response.status === 'error') {
      return false;
    }
    return response.booleanFlippers.get(flipperName)?.enabled ?? false;
  };

  const getStringList = async ({ flipperName, tenantId }: { flipperName: string; tenantId: string }) => {
    if (cache && cachedTenantId === tenantId && cachedStringListFlippers.size > 0) {
      return cachedStringListFlippers.get(flipperName)?.values ?? [];
    }
    const response = await loadFlipperData({ tenantId });
    if (response.status === 'error') {
      return [];
    }
    return response.stringListFlippers.get(flipperName)?.values ?? [];
  };

  const clientFns = {
    flipperData,
    loadFlipperData,
    isEnabled,
    getStringList,
  };

  return clientFns;
};

export default client;
