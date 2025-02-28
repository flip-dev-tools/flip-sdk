const baseUrl = process.env.FLIP_API_BASE_URL ?? 'https://api.feature-flipper.com';

const client = async ({ apiKey, tenantId }: { apiKey?: string; tenantId: string }) => {
  let booleanFlippers = new Map<string, boolean>();
  let stringListFlippers = new Map<string, string[]>();
  const key = apiKey || process.env.FLIP_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('process.env.FLIP_API_KEY is not set, and no apiKey was provided');
  }

  const headers = {
    'x-api-key': key,
  };

  const init = async () => {
    const encodedTenantId = encodeURIComponent(tenantId);
    const response = await fetch(`${baseUrl}/flippers/${encodedTenantId}`, { headers });
    const data = await response.json();
    if (data.length > 0) {
      data.forEach((flipper: any) => {
        if (flipper.type === 'boolean') {
          booleanFlippers.set(flipper.name, flipper.value);
        } else if (flipper.type === 'stringList') {
          stringListFlippers.set(flipper.name, flipper.value);
        }
      });
    }
  };

  await init();

  const isEnabled = (flipperName: string) => {
    return booleanFlippers.get(flipperName) ?? false;
  };

  const getStringList = (flipperName: string) => {
    return stringListFlippers.get(flipperName) ?? [];
  };

  return {
    isEnabled,
    getStringList,
  };
};

export default client;
