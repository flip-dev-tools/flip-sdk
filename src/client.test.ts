import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import client from './client.js';
import nock from 'nock';

describe('client', () => {
  beforeEach(() => {
    process.env.FLIP_API_KEY = 'test-api-key';
    nock.cleanAll();
  });

  afterEach(() => {
    delete process.env.FLIP_API_KEY;
    delete process.env.FLIP_API_BASE_URL;
    nock.cleanAll();
  });

  it('should throw an error if no API key is provided', () => {
    delete process.env.FLIP_API_KEY;
    expect(() => client({})).toThrow('process.env.FLIP_API_KEY is not set, and no API Key was provided');
  });

  it('should use provided API key', () => {
    delete process.env.FLIP_API_KEY;
    const flipClient = client({ apiKey: 'provided-api-key' });
    expect(flipClient).toBeDefined();
  });

  it('should load flipper data successfully', async () => {
    const mockData = {
      data: [
        { name: 'feature1', tenantId: 'tenant1', type: 'boolean', enabled: true, isDefault: false },
        { name: 'feature2', tenantId: 'tenant1', type: 'stringList', values: ['a', 'b'], isDefault: false }
      ]
    };
    
    nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .matchHeader('x-api-key', 'test-api-key')
      .reply(200, mockData);

    const flipClient = client({});
    const response = await flipClient.loadFlipperData({ tenantId: 'tenant1' });

    expect(response.status).toBe('success');
    if (response.status === 'success') {
      expect(response.flipperData).toEqual(mockData.data);
      expect(response.booleanFlippers.get('feature1')).toEqual(mockData.data[0]);
      expect(response.stringListFlippers.get('feature2')).toEqual(mockData.data[1]);
    }
  });

  it('should handle API errors', async () => {
    nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .replyWithError('Network error');

    const flipClient = client({});
    const response = await flipClient.loadFlipperData({ tenantId: 'tenant1' }) as { status: 'error', error: string };

    expect(response.status).toBe('error');
    expect(response.error).toBe('Failed to fetch flippers');
  });

  it('should handle non-OK responses', async () => {
    nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .reply(404, { error: 'Not found' });

    const flipClient = client({});
    const response = await flipClient.loadFlipperData({ tenantId: 'tenant1' }) as { status: 'error', error: string };

    expect(response.status).toBe('error');
    expect(response.error).toBe('Failed to fetch flippers');
  });

  it('should check if a boolean flipper is enabled', async () => {
    const mockData = {
      data: [
        { name: 'feature1', tenantId: 'tenant1', type: 'boolean', enabled: true, isDefault: false }
      ]
    };

    nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .matchHeader('x-api-key', 'test-api-key')
      .reply(200, mockData);

    const flipClient = client({});
    const enabled = await flipClient.isEnabled({ flipperName: 'feature1', tenantId: 'tenant1' });

    expect(enabled).toBe(true);
  });

  it('should return false for non-existent boolean flippers', async () => {
    const mockData = { data: [] };
    
    nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .reply(200, mockData);

    const flipClient = client({});
    const enabled = await flipClient.isEnabled({ flipperName: 'nonexistent', tenantId: 'tenant1' });

    expect(enabled).toBe(false);
  });

  it('should get string list values', async () => {
    const mockData = {
      data: [
        { name: 'feature1', tenantId: 'tenant1', type: 'stringList', values: ['a', 'b'], isDefault: false }
      ]
    };

    nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .reply(200, mockData);

    const flipClient = client({});
    const values = await flipClient.getStringList({ flipperName: 'feature1', tenantId: 'tenant1' });

    expect(values).toEqual(['a', 'b']);
  });

  it('should return empty array for non-existent string list flippers', async () => {
    const mockData = { data: [] };
    
    nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .reply(200, mockData);

    const flipClient = client({});
    const values = await flipClient.getStringList({ flipperName: 'nonexistent', tenantId: 'tenant1' });

    expect(values).toEqual([]);
  });

  describe('caching', () => {
    it('should use cached data when cache is enabled', async () => {
      const mockData = {
        data: [
          { name: 'feature1', tenantId: 'tenant1', type: 'boolean', enabled: true, isDefault: false },
          { name: 'feature2', tenantId: 'tenant1', type: 'stringList', values: ['a', 'b'], isDefault: false }
        ]
      };

      nock('https://api.feature-flipper.com')
        .get('/flippers/tenant1?defaultsFallback=false')
        .reply(200, mockData);

      const flipClient = client({ cache: true });
      
      await flipClient.loadFlipperData({ tenantId: 'tenant1' });
      
      // Should use cache and not make another API call
      const enabled = await flipClient.isEnabled({ flipperName: 'feature1', tenantId: 'tenant1' });
      const values = await flipClient.getStringList({ flipperName: 'feature2', tenantId: 'tenant1' });

      expect(enabled).toBe(true);
      expect(values).toEqual(['a', 'b']);
      expect(nock.isDone()).toBe(true); // Verify all mocked endpoints were called
    });

    it('should not use cache when cache is disabled', async () => {
      const mockData = {
        data: [
          { name: 'feature1', tenantId: 'tenant1', type: 'boolean', enabled: true, isDefault: false }
        ]
      };

      // Need to mock the endpoint twice since it will be called twice without caching
      const scope = nock('https://api.feature-flipper.com')
        .get('/flippers/tenant1?defaultsFallback=false')
        .reply(200, mockData)
        .get('/flippers/tenant1?defaultsFallback=false')
        .reply(200, mockData);

      const flipClient = client({ cache: false });
      
      await flipClient.loadFlipperData({ tenantId: 'tenant1' });
      await flipClient.isEnabled({ flipperName: 'feature1', tenantId: 'tenant1' });

      expect(scope.isDone()).toBe(true); // Verify both mocked endpoints were called
    });
  });

  it('should use the correct API base URL', async () => {
    process.env.FLIP_API_BASE_URL = 'https://custom-api.example.com';
    
    const mockData = { data: [] };
    
    const scope = nock('https://custom-api.example.com')
      .get('/flippers/tenant1?defaultsFallback=false')
      .matchHeader('x-api-key', 'test-api-key')
      .reply(200, mockData);

    const flipClient = client({});
    await flipClient.loadFlipperData({ tenantId: 'tenant1' });

    expect(scope.isDone()).toBe(true);
  });

  it('should include defaultsFallback parameter', async () => {
    const mockData = { data: [] };
    
    const scope = nock('https://api.feature-flipper.com')
      .get('/flippers/tenant1?defaultsFallback=true')
      .reply(200, mockData);

    const flipClient = client({ defaultsFallback: true });
    await flipClient.loadFlipperData({ tenantId: 'tenant1' });

    expect(scope.isDone()).toBe(true);
  });
});