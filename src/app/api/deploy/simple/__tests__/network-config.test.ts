/**
 * @jest-environment node
 */
import { getNetworkConfig } from '@/lib/network-config';

describe('Deploy Route Network Configuration Integration', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Network Selection', () => {
    it('should use testnet configuration when BASE_NETWORK is not set', () => {
      delete process.env.BASE_NETWORK;
      const config = getNetworkConfig();
      
      expect(config.chainId).toBe(84532);
      expect(config.name).toBe('Base Sepolia');
      expect(config.isMainnet).toBe(false);
    });

    it('should use mainnet configuration when BASE_NETWORK is set to mainnet', () => {
      process.env.BASE_NETWORK = 'mainnet';
      const config = getNetworkConfig();
      
      expect(config.chainId).toBe(8453);
      expect(config.name).toBe('Base');
      expect(config.isMainnet).toBe(true);
    });

    it('should handle invalid network configuration', () => {
      process.env.BASE_NETWORK = 'invalid';
      
      expect(() => getNetworkConfig()).toThrow('Invalid BASE_NETWORK value');
    });
  });
});