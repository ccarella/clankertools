import { getClientNetworkConfig } from '../client-network-config';

describe('getClientNetworkConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return testnet configuration when NEXT_PUBLIC_BASE_NETWORK is not set', () => {
    delete process.env.NEXT_PUBLIC_BASE_NETWORK;
    const config = getClientNetworkConfig();
    
    expect(config).toEqual({
      network: 'testnet',
      chainId: 84532,
      chainIdHex: '0x14A34',
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      isMainnet: false
    });
  });

  it('should return testnet configuration when NEXT_PUBLIC_BASE_NETWORK is testnet', () => {
    process.env.NEXT_PUBLIC_BASE_NETWORK = 'testnet';
    const config = getClientNetworkConfig();
    
    expect(config).toEqual({
      network: 'testnet',
      chainId: 84532,
      chainIdHex: '0x14A34',
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      isMainnet: false
    });
  });

  it('should return mainnet configuration when NEXT_PUBLIC_BASE_NETWORK is mainnet', () => {
    process.env.NEXT_PUBLIC_BASE_NETWORK = 'mainnet';
    const config = getClientNetworkConfig();
    
    expect(config).toEqual({
      network: 'mainnet',
      chainId: 8453,
      chainIdHex: '0x2105',
      name: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      isMainnet: true
    });
  });

  it('should default to testnet for invalid NEXT_PUBLIC_BASE_NETWORK values', () => {
    process.env.NEXT_PUBLIC_BASE_NETWORK = 'invalid';
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    const config = getClientNetworkConfig();
    
    expect(config.network).toBe('testnet');
    expect(config.chainId).toBe(84532);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Invalid NEXT_PUBLIC_BASE_NETWORK value: invalid. Defaulting to testnet'
    );
    
    consoleWarnSpy.mockRestore();
  });

  it('should handle uppercase NEXT_PUBLIC_BASE_NETWORK values', () => {
    process.env.NEXT_PUBLIC_BASE_NETWORK = 'MAINNET';
    const config = getClientNetworkConfig();
    
    expect(config.network).toBe('mainnet');
    expect(config.chainId).toBe(8453);
  });

  it('should handle NEXT_PUBLIC_BASE_NETWORK with whitespace', () => {
    process.env.NEXT_PUBLIC_BASE_NETWORK = '  testnet  ';
    const config = getClientNetworkConfig();
    
    expect(config.network).toBe('testnet');
    expect(config.chainId).toBe(84532);
  });
});