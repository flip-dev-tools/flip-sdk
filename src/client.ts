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

const client = ({ apiKey }: { apiKey?: string }) => {
  let booleanFlippers = new Map<string, Flipper>();
  let stringListFlippers = new Map<string, Flipper>();

  const baseUrl = process.env.FLIP_API_BASE_URL ?? 'https://api.feature-flipper.com';
  const key = apiKey || process.env.FLIP_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('process.env.FLIP_API_KEY is not set, and no API Key was provided');
  }

  const headers = {
    'x-api-key': key,
  };

  const init = async ({ tenantId }: { tenantId: string }): Promise<Flipper[]> => {
    const encodedTenantId = encodeURIComponent(tenantId);
    const response = await fetch(`${baseUrl}/flippers/${encodedTenantId}`, { headers });

    if (!response.ok) {
      console.error(`Failed to fetch flippers for tenant ${tenantId}`);
      return [];
    }

    const data = await response.json();
    if (data.length > 0) {
      data.forEach((flipper: any) => {
        if (flipper.type === 'boolean') {
          booleanFlippers.set(flipper.name, flipper);
        } else if (flipper.type === 'stringList') {
          stringListFlippers.set(flipper.name, flipper);
        }
      });
      return data;
    }
    return [];
  };

  const isEnabled = (flipperName: string) => {
    return booleanFlippers.get(flipperName)?.enabled ?? false;
  };

  const getStringList = (flipperName: string) => {
    return stringListFlippers.get(flipperName)?.values ?? [];
  };

  return {
    init,
    isEnabled,
    getStringList,
  };
};

export default client;
