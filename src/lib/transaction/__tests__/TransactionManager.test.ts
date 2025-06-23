/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransactionManager } from '../TransactionManager';

// Mock Redis at the module level
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  lpush: jest.fn(),
  rpop: jest.fn(),
  lrange: jest.fn(),
  lrem: jest.fn(),
  hset: jest.fn(),
  hget: jest.fn(),
  hgetall: jest.fn(),
  hdel: jest.fn(),
  expire: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

// Mock external processor function
const mockProcessor = jest.fn();

describe('TransactionManager', () => {
  let manager: TransactionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset mock responses
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.lpush.mockResolvedValue(1);
    mockRedis.rpop.mockResolvedValue(null);
    mockRedis.lrange.mockResolvedValue([]);
    mockRedis.hgetall.mockResolvedValue(null);
    mockRedis.publish.mockResolvedValue(1);
    
    // Reset processor mock
    mockProcessor.mockResolvedValue({ success: true, result: 'processed' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should create only one instance', () => {
      const instance1 = TransactionManager.getInstance();
      const instance2 = TransactionManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize with configuration', () => {
      const config = {
        maxRetries: 3,
        retryDelay: 5000,
        processor: mockProcessor,
      };
      
      const instance = TransactionManager.getInstance(config);
      
      expect(instance).toBeDefined();
      expect((instance as any).config.maxRetries).toBe(3);
      expect((instance as any).config.retryDelay).toBe(5000);
    });
  });

  describe('Transaction Queueing', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should queue transaction with high priority', async () => {
      const tx = {
        type: 'token_deployment',
        payload: {
          name: 'Test Token',
          symbol: 'TEST',
          imageUrl: 'https://example.com/image.png',
        },
      };
      const metadata = {
        userId: 123,
        description: 'Deploy TEST token',
      };

      const txId = await manager.queueTransaction(tx, metadata, 'high');

      expect(txId).toMatch(/^tx_[a-f0-9]+$/);
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'tx:queue:high',
        expect.stringContaining(txId)
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          transaction: JSON.stringify(tx),
          metadata: JSON.stringify(metadata),
          status: 'queued',
          priority: 'high',
        })
      );
    });

    it('should queue transaction with medium priority by default', async () => {
      const tx = {
        type: 'wallet_connection',
        payload: {
          walletAddress: '0xabcdef1234567890',
        },
      };
      const metadata = {
        userId: 456,
        description: 'Connect wallet',
      };

      const txId = await manager.queueTransaction(tx, metadata);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'tx:queue:medium',
        expect.stringContaining(txId)
      );
    });

    it('should queue transaction with low priority', async () => {
      const tx = {
        type: 'metadata_update',
        payload: {
          tokenAddress: '0xabcdef1234567890',
          updates: { description: 'Updated description' },
        },
      };
      const metadata = {
        userId: 789,
        description: 'Update token metadata',
      };

      const txId = await manager.queueTransaction(tx, metadata, 'low');

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'tx:queue:low',
        expect.stringContaining(txId)
      );
    });

    it('should validate transaction before queueing', async () => {
      const invalidTx = {
        // Missing 'type' field
        payload: { name: 'Test' },
      };
      const metadata = {
        userId: 123,
        description: 'Deploy token',
      };

      await expect(
        manager.queueTransaction(invalidTx as any, metadata)
      ).rejects.toThrow('Invalid transaction: missing required field "type"');
    });

    it('should handle Redis errors when queueing', async () => {
      mockRedis.lpush.mockRejectedValueOnce(new Error('Redis connection failed'));

      const tx = {
        type: 'token_deployment',
        payload: {
          name: 'Test Token',
          symbol: 'TEST',
        },
      };
      const metadata = {
        userId: 123,
        description: 'Deploy token',
      };

      await expect(
        manager.queueTransaction(tx, metadata)
      ).rejects.toThrow('Failed to queue transaction: Redis connection failed');
    });
  });

  describe('Transaction Processing', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should process transactions from high priority queue first', async () => {
      const highPriorityTxId = 'tx_high_123';
      
      mockRedis.rpop
        .mockResolvedValueOnce(highPriorityTxId)
        .mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({
          type: 'token_deployment',
          payload: { name: 'TEST', symbol: 'TEST' },
        }),
        metadata: JSON.stringify({
          userId: 123,
          description: 'Deploy TEST token',
        }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      await manager.processQueue();

      expect(mockRedis.rpop).toHaveBeenCalledWith('tx:queue:high');
      expect(mockProcessor).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'token_deployment',
          payload: { name: 'TEST', symbol: 'TEST' },
        })
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${highPriorityTxId}`,
        expect.objectContaining({
          status: 'processing',
        })
      );
    });

    it('should process medium priority after high priority queue is empty', async () => {
      mockRedis.rpop
        .mockResolvedValueOnce(null) // high priority empty
        .mockResolvedValueOnce('tx_medium_456')
        .mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({
          type: 'wallet_connection',
          payload: { walletAddress: '0xabc' },
        }),
        metadata: JSON.stringify({
          userId: 456,
        }),
        status: 'queued',
        priority: 'medium',
        createdAt: Date.now().toString(),
      });

      await manager.processQueue();

      expect(mockRedis.rpop).toHaveBeenCalledWith('tx:queue:high');
      expect(mockRedis.rpop).toHaveBeenCalledWith('tx:queue:medium');
    });

    it('should update transaction status during processing', async () => {
      const txId = 'tx_123';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      mockProcessor.mockResolvedValueOnce({
        success: true,
        result: { txHash: '0xtxhash', blockNumber: 1001 },
      });

      await manager.processQueue();

      // Should update to processing
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          status: 'processing',
        })
      );

      // Should update to completed
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          status: 'completed',
          result: JSON.stringify({ txHash: '0xtxhash', blockNumber: 1001 }),
        })
      );

      // Should publish status updates
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `tx:status:${txId}`,
        expect.stringContaining('"status":"processing"')
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `tx:status:${txId}`,
        expect.stringContaining('"status":"completed"')
      );
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should retry transaction on temporary failure', async () => {
      const txId = 'tx_retry_123';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
        retryCount: '0',
      });

      // First attempt fails
      mockProcessor.mockRejectedValueOnce(
        new Error('Network temporarily unavailable')
      );

      await manager.processQueue();

      // Should update retry count and requeue
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          status: 'queued',
          retryCount: '1',
          lastError: 'Network temporarily unavailable',
        })
      );
      expect(mockRedis.lpush).toHaveBeenCalledWith('tx:queue:high', txId);
    });

    it('should use exponential backoff for retries', async () => {
      const txId = 'tx_backoff_123';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      const now = Date.now();
      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: now.toString(),
        retryCount: '2',
        lastRetryAt: (now - 1000).toString(), // 1 second ago
      });

      await manager.processQueue();

      // Should not process if backoff time hasn't passed
      expect(mockProcessor).not.toHaveBeenCalled();
      
      // Should calculate backoff: baseDelay * 2^retryCount = 5000 * 4 = 20000ms
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          nextRetryAt: expect.any(String),
        })
      );
    });

    it('should fail transaction after max retries', async () => {
      const txId = 'tx_maxretry_123';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
        retryCount: '5', // Max retries reached
      });

      mockProcessor.mockRejectedValueOnce(new Error('Network error'));

      await manager.processQueue();

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          status: 'failed',
          error: 'Max retries exceeded: Network error',
        })
      );
      expect(mockRedis.lpush).not.toHaveBeenCalled(); // Should not requeue
    });

    it('should handle different error types appropriately', async () => {
      const txId = 'tx_error_123';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      // Non-retryable error
      mockProcessor.mockRejectedValueOnce(
        new Error('Invalid payload: missing required field')
      );

      await manager.processQueue();

      // Should fail immediately without retry
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          status: 'failed',
          error: 'Invalid payload: missing required field',
        })
      );
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });
  });

  describe('Transaction Cancellation', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should cancel queued transaction', async () => {
      const txId = 'tx_cancel_123';
      
      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      const result = await manager.cancelTransaction(txId);

      expect(result).toBe(true);
      expect(mockRedis.lrem).toHaveBeenCalledWith('tx:queue:high', 0, txId);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          status: 'cancelled',
          cancelledAt: expect.any(String),
        })
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `tx:status:${txId}`,
        expect.stringContaining('"status":"cancelled"')
      );
    });

    it('should not cancel processing transaction', async () => {
      const txId = 'tx_processing_123';
      
      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'processing',
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      const result = await manager.cancelTransaction(txId);

      expect(result).toBe(false);
      expect(mockRedis.lrem).not.toHaveBeenCalled();
      expect(mockRedis.hset).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'cancelled' })
      );
    });

    it('should not cancel already completed transaction', async () => {
      const txId = 'tx_completed_123';
      
      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'completed',
        priority: 'high',
        createdAt: Date.now().toString(),
        result: JSON.stringify({ txHash: '0xabc' }),
      });

      const result = await manager.cancelTransaction(txId);

      expect(result).toBe(false);
    });

    it('should handle non-existent transaction', async () => {
      const txId = 'tx_nonexistent_123';
      mockRedis.hgetall.mockResolvedValueOnce(null);

      await expect(manager.cancelTransaction(txId)).rejects.toThrow(
        'Transaction not found'
      );
    });
  });

  describe('Transaction History', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should get user transaction history', async () => {
      const userId = 123;
      const txIds = ['tx_1', 'tx_2', 'tx_3'];
      
      mockRedis.lrange.mockResolvedValueOnce(txIds);
      mockRedis.hgetall
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
          metadata: JSON.stringify({ userId, description: 'Deploy token' }),
          status: 'completed',
          createdAt: '1000',
        })
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'wallet_connection', payload: {} }),
          metadata: JSON.stringify({ userId, description: 'Connect wallet' }),
          status: 'processing',
          createdAt: '2000',
        })
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'metadata_update', payload: {} }),
          metadata: JSON.stringify({ userId, description: 'Update metadata' }),
          status: 'failed',
          createdAt: '3000',
          error: 'Network error',
        });

      const history = await manager.getUserTransactionHistory(userId);

      expect(history).toHaveLength(3);
      expect(history[0]).toMatchObject({
        id: 'tx_1',
        status: 'completed',
        type: 'token_deployment',
        createdAt: 1000,
      });
      expect(history[1]).toMatchObject({
        id: 'tx_2',
        status: 'processing',
        type: 'wallet_connection',
      });
      expect(history[2]).toMatchObject({
        id: 'tx_3',
        status: 'failed',
        error: 'Network error',
      });
    });

    it('should filter transaction history by status', async () => {
      const userId = 123;
      const txIds = ['tx_1', 'tx_2', 'tx_3'];
      
      mockRedis.lrange.mockResolvedValueOnce(txIds);
      mockRedis.hgetall
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
          metadata: JSON.stringify({ userId }),
          status: 'completed',
          createdAt: '1000',
        })
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'wallet_connection', payload: {} }),
          metadata: JSON.stringify({ userId }),
          status: 'processing',
          createdAt: '2000',
        })
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'metadata_update', payload: {} }),
          metadata: JSON.stringify({ userId }),
          status: 'completed',
          createdAt: '3000',
        });

      const history = await manager.getUserTransactionHistory(userId, {
        status: 'completed',
      });

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('completed');
      expect(history[1].status).toBe('completed');
    });

    it('should filter transaction history by type', async () => {
      const userId = 123;
      const txIds = ['tx_1', 'tx_2'];
      
      mockRedis.lrange.mockResolvedValueOnce(txIds);
      mockRedis.hgetall
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
          metadata: JSON.stringify({ userId }),
          status: 'completed',
          createdAt: '1000',
        })
        .mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'wallet_connection', payload: {} }),
          metadata: JSON.stringify({ userId }),
          status: 'completed',
          createdAt: '2000',
        });

      const history = await manager.getUserTransactionHistory(userId, {
        type: 'token_deployment',
      });

      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('token_deployment');
    });

    it('should paginate transaction history', async () => {
      const userId = 123;
      const allTxIds = Array.from({ length: 25 }, (_, i) => `tx_${i}`);
      
      mockRedis.lrange.mockResolvedValueOnce(allTxIds.slice(0, 10));

      // Mock responses for each transaction
      for (let i = 0; i < 10; i++) {
        mockRedis.hgetall.mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
          metadata: JSON.stringify({ userId }),
          status: 'completed',
          createdAt: String(i * 1000),
        });
      }

      const history = await manager.getUserTransactionHistory(userId, {
        limit: 10,
        offset: 0,
      });

      expect(history).toHaveLength(10);
      expect(mockRedis.lrange).toHaveBeenCalledWith(
        `user:${userId}:transactions`,
        0,
        9
      );
    });
  });

  describe('Status Subscriptions', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should subscribe to transaction status updates', async () => {
      const txId = 'tx_sub_123';
      const callback = jest.fn();

      await manager.subscribeToTransaction(txId, callback);

      // Simulate status update
      const statusUpdate = {
        status: 'processing',
        timestamp: Date.now(),
      };
      
      // Trigger the subscription callback
      const subscribeCall = mockRedis.subscribe.mock.calls[0];
      const handler = subscribeCall[1];
      
      handler(JSON.stringify(statusUpdate));

      expect(callback).toHaveBeenCalledWith(statusUpdate);
      expect(mockRedis.subscribe).toHaveBeenCalledWith(
        `tx:status:${txId}`,
        expect.any(Function)
      );
    });

    it('should unsubscribe from transaction status updates', async () => {
      const txId = 'tx_unsub_123';
      const callback = jest.fn();

      const unsubscribe = await manager.subscribeToTransaction(txId, callback);
      await unsubscribe();

      expect(mockRedis.unsubscribe).toHaveBeenCalledWith(`tx:status:${txId}`);
    });

    it('should handle multiple subscribers for same transaction', async () => {
      const txId = 'tx_multi_123';
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await manager.subscribeToTransaction(txId, callback1);
      await manager.subscribeToTransaction(txId, callback2);

      // Simulate status update
      const statusUpdate = { status: 'completed' };
      
      // Get both handlers
      const handlers = mockRedis.subscribe.mock.calls.map(call => call[1]);
      handlers.forEach(handler => handler(JSON.stringify(statusUpdate)));

      expect(callback1).toHaveBeenCalledWith(statusUpdate);
      expect(callback2).toHaveBeenCalledWith(statusUpdate);
    });

    it('should handle subscription errors gracefully', async () => {
      const txId = 'tx_error_123';
      const callback = jest.fn();

      mockRedis.subscribe.mockRejectedValueOnce(new Error('Subscribe failed'));

      await expect(
        manager.subscribeToTransaction(txId, callback)
      ).rejects.toThrow('Failed to subscribe to transaction updates');
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should handle processor errors', async () => {
      const txId = 'tx_processor_error';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      mockProcessor.mockRejectedValueOnce(
        new Error('External service unavailable')
      );

      await manager.processQueue();

      // Should retry the transaction
      expect(mockRedis.lpush).toHaveBeenCalledWith('tx:queue:high', txId);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          lastError: 'External service unavailable',
          retryCount: '1',
        })
      );
    });

    it('should handle validation errors', async () => {
      const txId = 'tx_validation_error';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'queued',
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      mockProcessor.mockRejectedValueOnce(
        new Error('Validation failed: invalid payload')
      );

      await manager.processQueue();

      // Should fail immediately for validation errors
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `tx:data:${txId}`,
        expect.objectContaining({
          status: 'failed',
          error: 'Validation failed: invalid payload',
        })
      );
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    it('should handle concurrent processing attempts', async () => {
      const txId = 'tx_concurrent';
      mockRedis.rpop.mockResolvedValueOnce(txId).mockResolvedValueOnce(null);

      mockRedis.hgetall.mockResolvedValueOnce({
        transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
        metadata: JSON.stringify({ userId: 123 }),
        status: 'processing', // Already being processed
        priority: 'high',
        createdAt: Date.now().toString(),
      });

      await manager.processQueue();

      // Should skip already processing transaction
      expect(mockProcessor).not.toHaveBeenCalled();
    });

    it('should clean up old transactions', async () => {
      const oldTxIds = ['tx_old_1', 'tx_old_2', 'tx_old_3'];
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      mockRedis.lrange.mockResolvedValueOnce(oldTxIds);
      
      for (let i = 0; i < oldTxIds.length; i++) {
        mockRedis.hgetall.mockResolvedValueOnce({
          status: 'completed',
          createdAt: String(oneWeekAgo - 1000), // Older than 7 days
        });
      }

      await manager.cleanupOldTransactions();

      expect(mockRedis.hdel).toHaveBeenCalledTimes(3);
      expect(mockRedis.lrem).toHaveBeenCalledTimes(3);
    });

    it('should recover from queue processing errors', async () => {
      mockRedis.rpop.mockRejectedValueOnce(new Error('Redis timeout'));

      await expect(manager.processQueue()).resolves.not.toThrow();
      
      // Should log error but not crash
      expect(mockRedis.rpop).toHaveBeenCalled();
    });
  });

  describe('Transaction Metrics', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should track transaction metrics', async () => {
      mockRedis.lrange
        .mockResolvedValueOnce(['tx_1', 'tx_2']) // queued
        .mockResolvedValueOnce(['tx_3']) // processing
        .mockResolvedValueOnce(['tx_4', 'tx_5', 'tx_6']) // completed
        .mockResolvedValueOnce(['tx_7']); // failed

      const metrics = await manager.getMetrics();

      expect(metrics).toMatchObject({
        queuedTransactions: 2,
        processingTransactions: 1,
        completedTransactions: 3,
        failedTransactions: 1,
        totalTransactions: 7,
      });
    });

    it('should get transaction statistics by type', async () => {
      mockRedis.hgetall.mockResolvedValue({
        token_deployment: '10',
        wallet_connection: '5',
        metadata_update: '3',
      });

      const stats = await manager.getTransactionStats();

      expect(stats).toMatchObject({
        byType: {
          token_deployment: 10,
          wallet_connection: 5,
          metadata_update: 3,
        },
        total: 18,
      });
    });
  });

  describe('Auto Processing', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should start auto processing with interval', () => {
      manager.startAutoProcessing(1000);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should stop auto processing', () => {
      manager.startAutoProcessing(1000);
      manager.stopAutoProcessing();

      expect(clearInterval).toHaveBeenCalled();
    });

    it('should not start multiple auto processing intervals', () => {
      manager.startAutoProcessing(1000);
      manager.startAutoProcessing(2000);

      expect(setInterval).toHaveBeenCalledTimes(1);
      expect(clearInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      manager = TransactionManager.getInstance({ processor: mockProcessor });
    });

    it('should queue multiple transactions in bulk', async () => {
      const transactions = [
        {
          transaction: { type: 'token_deployment', payload: { name: 'Token1' } },
          metadata: { userId: 1 },
          priority: 'high' as const,
        },
        {
          transaction: { type: 'token_deployment', payload: { name: 'Token2' } },
          metadata: { userId: 2 },
          priority: 'medium' as const,
        },
        {
          transaction: { type: 'wallet_connection', payload: { walletAddress: '0xabc' } },
          metadata: { userId: 3 },
          priority: 'low' as const,
        },
      ];

      const txIds = await manager.bulkQueueTransactions(transactions);

      expect(txIds).toHaveLength(3);
      expect(mockRedis.lpush).toHaveBeenCalledTimes(3);
      expect(mockRedis.lpush).toHaveBeenCalledWith('tx:queue:high', expect.any(String));
      expect(mockRedis.lpush).toHaveBeenCalledWith('tx:queue:medium', expect.any(String));
      expect(mockRedis.lpush).toHaveBeenCalledWith('tx:queue:low', expect.any(String));
    });

    it('should cancel multiple transactions in bulk', async () => {
      const txIds = ['tx_1', 'tx_2', 'tx_3'];
      
      for (let i = 0; i < txIds.length; i++) {
        mockRedis.hgetall.mockResolvedValueOnce({
          transaction: JSON.stringify({ type: 'token_deployment', payload: {} }),
          metadata: JSON.stringify({ userId: 123 }),
          status: 'queued',
          priority: 'high',
          createdAt: Date.now().toString(),
        });
      }

      const results = await manager.bulkCancelTransactions(txIds);

      expect(results).toEqual([
        { txId: 'tx_1', success: true },
        { txId: 'tx_2', success: true },
        { txId: 'tx_3', success: true },
      ]);
      expect(mockRedis.lrem).toHaveBeenCalledTimes(3);
    });
  });
});