import { getNetworkConfig } from '../network-config';

describe('getNetworkConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return testnet configuration when BASE_NETWORK is not set', () => {
    delete process.env.BASE_NETWORK;
    const config = getNetworkConfig();
    
    expect(config).toEqual({
      network: 'testnet',
      chainId: 84532,
      chainIdHex: '0x14A34',
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      isMainnet: false
    });
  });

  it('should return testnet configuration when BASE_NETWORK is testnet', () => {
    process.env.BASE_NETWORK = 'testnet';
    const config = getNetworkConfig();
    
    expect(config).toEqual({
      network: 'testnet',
      chainId: 84532,
      chainIdHex: '0x14A34',
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      isMainnet: false
    });
  });

  it('should return mainnet configuration when BASE_NETWORK is mainnet', () => {
    process.env.BASE_NETWORK = 'mainnet';
    const config = getNetworkConfig();
    
    expect(config).toEqual({
      network: 'mainnet',
      chainId: 8453,
      chainIdHex: '0x2105',
      name: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      isMainnet: true
    });
  });

  it('should throw error for invalid BASE_NETWORK values', () => {
    process.env.BASE_NETWORK = 'invalid';
    
    expect(() => getNetworkConfig()).toThrow('Invalid BASE_NETWORK value: invalid. Must be either "mainnet" or "testnet"');
  });

  it('should handle uppercase BASE_NETWORK values', () => {
    process.env.BASE_NETWORK = 'MAINNET';
    const config = getNetworkConfig();
    
    expect(config.network).toBe('mainnet');
    expect(config.chainId).toBe(8453);
  });

  it('should handle BASE_NETWORK with whitespace', () => {
    process.env.BASE_NETWORK = '  testnet  ';
    const config = getNetworkConfig();
    
    expect(config.network).toBe('testnet');
    expect(config.chainId).toBe(84532);
  });
});