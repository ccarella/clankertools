import { getNetworkConfig, BASE_NETWORKS } from '@/lib/network-config';

describe('NetworkConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getNetworkConfig', () => {
    it('should return testnet config by default when BASE_NETWORK is not set', () => {
      delete process.env.BASE_NETWORK;
      const config = getNetworkConfig();
      
      expect(config.chainId).toBe(84532);
      expect(config.chainIdHex).toBe('0x14A34');
      expect(config.name).toBe('Base Sepolia');
      expect(config.rpcUrl).toBe('https://sepolia.base.org');
      expect(config.isMainnet).toBe(false);
      expect(config.network).toBe('testnet');
    });

    it('should return testnet config when BASE_NETWORK is explicitly set to testnet', () => {
      process.env.BASE_NETWORK = 'testnet';
      const config = getNetworkConfig();
      
      expect(config.chainId).toBe(84532);
      expect(config.chainIdHex).toBe('0x14A34');
      expect(config.name).toBe('Base Sepolia');
      expect(config.rpcUrl).toBe('https://sepolia.base.org');
      expect(config.isMainnet).toBe(false);
      expect(config.network).toBe('testnet');
    });

    it('should return mainnet config when BASE_NETWORK is set to mainnet', () => {
      process.env.BASE_NETWORK = 'mainnet';
      const config = getNetworkConfig();
      
      expect(config.chainId).toBe(8453);
      expect(config.chainIdHex).toBe('0x2105');
      expect(config.name).toBe('Base');
      expect(config.rpcUrl).toBe('https://mainnet.base.org');
      expect(config.isMainnet).toBe(true);
      expect(config.network).toBe('mainnet');
    });

    it('should handle case-insensitive network names', () => {
      process.env.BASE_NETWORK = 'MAINNET';
      let config = getNetworkConfig();
      expect(config.network).toBe('mainnet');

      process.env.BASE_NETWORK = 'TeStNeT';
      config = getNetworkConfig();
      expect(config.network).toBe('testnet');
    });

    it('should throw error for invalid network names', () => {
      process.env.BASE_NETWORK = 'invalid-network';
      expect(() => getNetworkConfig()).toThrow('Invalid BASE_NETWORK value: invalid-network. Must be either "mainnet" or "testnet"');
    });

    it('should handle whitespace in network names', () => {
      process.env.BASE_NETWORK = '  mainnet  ';
      const config = getNetworkConfig();
      expect(config.network).toBe('mainnet');
    });
  });

  describe('BASE_NETWORKS constant', () => {
    it('should contain mainnet configuration', () => {
      expect(BASE_NETWORKS.mainnet).toEqual({
        chainId: 8453,
        chainIdHex: '0x2105',
        name: 'Base',
        rpcUrl: 'https://mainnet.base.org',
        isMainnet: true,
        network: 'mainnet'
      });
    });

    it('should contain testnet configuration', () => {
      expect(BASE_NETWORKS.testnet).toEqual({
        chainId: 84532,
        chainIdHex: '0x14A34',
        name: 'Base Sepolia',
        rpcUrl: 'https://sepolia.base.org',
        isMainnet: false,
        network: 'testnet'
      });
    });
  });

  describe('NetworkConfig type', () => {
    it('should match expected structure', () => {
      const config = getNetworkConfig();
      
      // Type checking happens at compile time, but we can verify structure
      expect(config).toHaveProperty('chainId');
      expect(config).toHaveProperty('chainIdHex');
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('rpcUrl');
      expect(config).toHaveProperty('isMainnet');
      expect(config).toHaveProperty('network');
      
      expect(typeof config.chainId).toBe('number');
      expect(typeof config.chainIdHex).toBe('string');
      expect(typeof config.name).toBe('string');
      expect(typeof config.rpcUrl).toBe('string');
      expect(typeof config.isMainnet).toBe('boolean');
      expect(typeof config.network).toBe('string');
    });
  });
});