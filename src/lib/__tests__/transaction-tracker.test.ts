import { trackTransaction, getTransactionStatus, updateTransactionStatus } from '../transaction-tracker';
import { Redis } from '@upstash/redis';

jest.mock('@upstash/redis');

describe('transaction-tracker', () => {
  const mockRedis = {
    setex: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Redis as jest.Mock).mockReturnValue(mockRedis);
  });

  describe('trackTransaction', () => {
    it('should track a new transaction', async () => {
      const txHash = '0xabcdef1234567890';
      const metadata = {
        type: 'token_deployment' as const,
        tokenAddress: '0x1234567890',
        name: 'Test Token',
        symbol: 'TEST',
      };

      await trackTransaction(txHash, metadata);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `tx:${txHash}`,
        86400, // 24 hours
        JSON.stringify({
          status: 'pending',
          timestamp: expect.any(Number),
          ...metadata,
        })
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const txHash = '0xabcdef1234567890';
      const metadata = {
        type: 'token_deployment' as const,
        tokenAddress: '0x1234567890',
        name: 'Test Token',
        symbol: 'TEST',
      };

      // Should not throw
      await expect(trackTransaction(txHash, metadata)).resolves.toBeUndefined();
    });

    it('should validate transaction hash format', async () => {
      const invalidTxHash = 'invalid-hash';
      const metadata = {
        type: 'token_deployment' as const,
        tokenAddress: '0x1234567890',
        name: 'Test Token',
        symbol: 'TEST',
      };

      await expect(trackTransaction(invalidTxHash, metadata)).rejects.toThrow('Invalid transaction hash format');
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status', async () => {
      const txHash = '0xabcdef1234567890';
      const mockData = {
        status: 'confirmed',
        timestamp: Date.now(),
        type: 'token_deployment',
        tokenAddress: '0x1234567890',
        name: 'Test Token',
        symbol: 'TEST',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await getTransactionStatus(txHash);

      expect(result).toEqual(mockData);
      expect(mockRedis.get).toHaveBeenCalledWith(`tx:${txHash}`);
    });

    it('should return null for non-existent transaction', async () => {
      const txHash = '0xabcdef1234567890';
      mockRedis.get.mockResolvedValue(null);

      const result = await getTransactionStatus(txHash);

      expect(result).toBeNull();
    });

    it('should handle invalid JSON data', async () => {
      const txHash = '0xabcdef1234567890';
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await getTransactionStatus(txHash);

      expect(result).toBeNull();
    });

    it('should handle Redis errors', async () => {
      const txHash = '0xabcdef1234567890';
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getTransactionStatus(txHash);

      expect(result).toBeNull();
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status to confirmed', async () => {
      const txHash = '0xabcdef1234567890';
      const existingData = {
        status: 'pending',
        timestamp: Date.now(),
        type: 'token_deployment',
        tokenAddress: '0x1234567890',
        name: 'Test Token',
        symbol: 'TEST',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(existingData));

      await updateTransactionStatus(txHash, 'confirmed');

      expect(mockRedis.set).toHaveBeenCalledWith(
        `tx:${txHash}`,
        JSON.stringify({
          ...existingData,
          status: 'confirmed',
          updatedAt: expect.any(Number),
        })
      );
    });

    it('should update transaction status to failed with error', async () => {
      const txHash = '0xabcdef1234567890';
      const existingData = {
        status: 'pending',
        timestamp: Date.now(),
        type: 'token_deployment',
        tokenAddress: '0x1234567890',
        name: 'Test Token',
        symbol: 'TEST',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(existingData));

      await updateTransactionStatus(txHash, 'failed', 'Insufficient funds');

      expect(mockRedis.set).toHaveBeenCalledWith(
        `tx:${txHash}`,
        JSON.stringify({
          ...existingData,
          status: 'failed',
          error: 'Insufficient funds',
          updatedAt: expect.any(Number),
        })
      );
    });

    it('should throw error if transaction not found', async () => {
      const txHash = '0xabcdef1234567890';
      mockRedis.get.mockResolvedValue(null);

      await expect(updateTransactionStatus(txHash, 'confirmed')).rejects.toThrow('Transaction not found');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const txHash = '0xabcdef1234567890';
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      // Should not throw but log error
      await expect(updateTransactionStatus(txHash, 'confirmed')).resolves.toBeUndefined();
    });
  });
});