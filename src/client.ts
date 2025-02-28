const baseUrl = process.env.FLIP_API_BASE_URL || 'https://api.feature-flipper.com';

const client = (apiKey?: string) => {
  const key = apiKey || process.env.FLIP_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('process.env.FLIP_API_KEY is not set, and no apiKey was provided');
  }
  const headers = {
    'x-api-key': key,
  };

  const getFlippers = async (tenantId: string) => {
    const encodedTenantId = encodeURIComponent(tenantId);
    const response = await fetch(`${baseUrl}/tenants/${encodedTenantId}/flippers`, { headers });
    const data = await response.json();
    return data;
  };

  return {
    getFlippers,
  };
};

export default client;
