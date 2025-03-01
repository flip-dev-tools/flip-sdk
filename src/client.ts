interface Flipper {
  id: string;
  name: string;
  tenantId: string;
  stage: string;
  type: 'boolean' | 'stringList';
  enabled?: boolean;
  values?: string[];
  isDefault: boolean;
}

interface Client {
  flipperData: Flipper[];
  loadFlipperData: ({
    tenantId,
  }: {
    tenantId: string;
  }) => Promise<{ flipperData: Flipper[]; status: 'success' | 'error' }>;
  isEnabled: (flipperName: string) => boolean;
  getStringList: (flipperName: string) => string[];
}

const client = ({ apiKey, cache = true }: { apiKey?: string; cache?: boolean }): Client => {
  let booleanFlippers = new Map<string, Flipper>();
  let stringListFlippers = new Map<string, Flipper>();
  let flipperData: Flipper[] = [];

  const baseUrl = process.env.FLIP_API_BASE_URL ?? 'https://api.feature-flipper.com';
  const key = apiKey || process.env.FLIP_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('process.env.FLIP_API_KEY is not set, and no API Key was provided');
  }

  const headers = {
    'x-api-key': key,
  };

  const loadFlipperData = async ({
    tenantId,
  }: {
    tenantId: string;
  }): Promise<{ flipperData: Flipper[]; status: 'success' | 'error' }> => {
    try {
      const encodedTenantId = encodeURIComponent(tenantId);
      const response = await fetch(`${baseUrl}/flippers/${encodedTenantId}`, { headers });

      if (!response.ok) {
        console.error(`Failed to fetch flippers for tenant ${tenantId}`);
        return { flipperData: [], status: 'error' };
      }

      const data = await response.json();

      if (cache) {
        flipperData = data;
        data.forEach((flipper: any) => {
          if (flipper.type === 'boolean') {
            booleanFlippers.set(flipper.name, flipper);
          } else if (flipper.type === 'stringList') {
            stringListFlippers.set(flipper.name, flipper);
          }
        });
      }
      return { flipperData: data, status: 'success' };
    } catch (error) {
      console.error(`Failed to fetch flippers for tenant ${tenantId}, ${error}`);
      return { flipperData: [], status: 'error' };
    }
  };

  const isEnabled = (flipperName: string) => {
    return booleanFlippers.get(flipperName)?.enabled ?? false;
  };

  const getStringList = (flipperName: string) => {
    return stringListFlippers.get(flipperName)?.values ?? [];
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
