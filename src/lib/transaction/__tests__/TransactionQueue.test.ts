import { TransactionQueue } from '../TransactionQueue';
import {
  TransactionPriority,
  TransactionStatus,
  type QueuedTransaction,
} from '../types';

// Mock Redis at the module level
const mockRedis = {
  lpush: jest.fn(),
  rpush: jest.fn(),
  lpop: jest.fn(),
  rpop: jest.fn(),
  lrange: jest.fn(),
  llen: jest.fn(),
  del: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  multi: jest.fn(),
  exec: jest.fn(),
  watch: jest.fn(),
  unwatch: jest.fn(),
  ltrim: jest.fn(),
};

jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(() => mockRedis),
}));

describe('TransactionQueue', () => {
  let queue: TransactionQueue;
  const testQueueName = 'test-queue';

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new TransactionQueue(testQueueName);
    
    // Default mock implementations
    mockRedis.lpush.mockResolvedValue(1);
    mockRedis.rpush.mockResolvedValue(1);
    mockRedis.lpop.mockResolvedValue(null);
    mockRedis.rpop.mockResolvedValue(null);
    mockRedis.lrange.mockResolvedValue([]);
    mockRedis.llen.mockResolvedValue(0);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.ltrim.mockResolvedValue('OK');
    mockRedis.multi.mockReturnValue({
      setex: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      exec: jest.fn().mockResolvedValue(['OK']),
    });
  });

  describe('enqueue', () => {
    it('should enqueue a transaction with HIGH priority', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-123',
        priority: TransactionPriority.HIGH,
        data: {
          type: 'token_deployment',
          from: '0x1234567890',
          to: '0xabcdef1234',
          value: '1000000000000000000',
        },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await queue.enqueue(transaction);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        `queue:${testQueueName}:HIGH`,
        JSON.stringify(transaction)
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `queue:${testQueueName}:tx:${transaction.id}`,
        86400, // 24 hours
        JSON.stringify(transaction)
      );
    });

    it('should enqueue a transaction with MEDIUM priority', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-456',
        priority: TransactionPriority.MEDIUM,
        data: {
          type: 'token_transfer',
          from: '0x1234567890',
          to: '0xabcdef1234',
          amount: '500',
        },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await queue.enqueue(transaction);

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        `queue:${testQueueName}:MEDIUM`,
        JSON.stringify(transaction)
      );
    });

    it('should enqueue a transaction with LOW priority', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-789',
        priority: TransactionPriority.LOW,
        data: {
          type: 'metadata_update',
          tokenAddress: '0x1234567890',
        },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await queue.enqueue(transaction);

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        `queue:${testQueueName}:LOW`,
        JSON.stringify(transaction)
      );
    });

    it('should handle queue size limits', async () => {
      const maxQueueSize = 1000;
      queue = new TransactionQueue(testQueueName, { maxQueueSize });
      
      mockRedis.llen.mockResolvedValue(maxQueueSize);

      const transaction: QueuedTransaction = {
        id: 'tx-overflow',
        priority: TransactionPriority.MEDIUM,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await expect(queue.enqueue(transaction)).rejects.toThrow('Queue size limit exceeded');
      expect(mockRedis.rpush).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.rpush.mockRejectedValue(new Error('Redis connection error'));

      const transaction: QueuedTransaction = {
        id: 'tx-error',
        priority: TransactionPriority.MEDIUM,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await expect(queue.enqueue(transaction)).rejects.toThrow('Redis connection error');
    });

    it('should validate transaction data', async () => {
      const invalidTransaction = {
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      } as QueuedTransaction; // Missing id

      await expect(queue.enqueue(invalidTransaction)).rejects.toThrow('Invalid transaction: missing id');
    });
  });

  describe('dequeue', () => {
    it('should dequeue from HIGH priority queue first', async () => {
      const highPriorityTx: QueuedTransaction = {
        id: 'tx-high',
        priority: TransactionPriority.HIGH,
        data: { type: 'urgent' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.lpop.mockResolvedValueOnce(JSON.stringify(highPriorityTx));

      const result = await queue.dequeue();

      expect(result?.id).toBe(highPriorityTx.id);
      expect(result?.status).toBe(TransactionStatus.PROCESSING);
      expect(mockRedis.lpop).toHaveBeenCalledWith(`queue:${testQueueName}:HIGH`);
      expect(mockRedis.lpop).toHaveBeenCalledTimes(1);
    });

    it('should dequeue from MEDIUM priority queue when HIGH is empty', async () => {
      const mediumPriorityTx: QueuedTransaction = {
        id: 'tx-medium',
        priority: TransactionPriority.MEDIUM,
        data: { type: 'normal' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.lpop
        .mockResolvedValueOnce(null) // HIGH queue empty
        .mockResolvedValueOnce(JSON.stringify(mediumPriorityTx));

      const result = await queue.dequeue();

      expect(result?.id).toBe(mediumPriorityTx.id);
      expect(result?.status).toBe(TransactionStatus.PROCESSING);
      expect(mockRedis.lpop).toHaveBeenCalledWith(`queue:${testQueueName}:HIGH`);
      expect(mockRedis.lpop).toHaveBeenCalledWith(`queue:${testQueueName}:MEDIUM`);
      expect(mockRedis.lpop).toHaveBeenCalledTimes(2);
    });

    it('should dequeue from LOW priority queue when others are empty', async () => {
      const lowPriorityTx: QueuedTransaction = {
        id: 'tx-low',
        priority: TransactionPriority.LOW,
        data: { type: 'background' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.lpop
        .mockResolvedValueOnce(null) // HIGH queue empty
        .mockResolvedValueOnce(null) // MEDIUM queue empty
        .mockResolvedValueOnce(JSON.stringify(lowPriorityTx));

      const result = await queue.dequeue();

      expect(result?.id).toBe(lowPriorityTx.id);
      expect(result?.status).toBe(TransactionStatus.PROCESSING);
      expect(mockRedis.lpop).toHaveBeenCalledTimes(3);
    });

    it('should return null when all queues are empty', async () => {
      mockRedis.lpop.mockResolvedValue(null);

      const result = await queue.dequeue();

      expect(result).toBeNull();
      expect(mockRedis.lpop).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed JSON data', async () => {
      mockRedis.lpop.mockResolvedValueOnce('invalid-json');

      const result = await queue.dequeue();

      expect(result).toBeNull();
    });

    it('should update transaction status to PROCESSING', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-123',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.lpop.mockResolvedValueOnce(JSON.stringify(transaction));

      const result = await queue.dequeue();

      expect(result?.status).toBe(TransactionStatus.PROCESSING);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `queue:${testQueueName}:tx:${transaction.id}`,
        86400,
        expect.stringContaining('"status":"PROCESSING"')
      );
    });
  });

  describe('peek', () => {
    it('should peek at the next transaction without removing it', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-peek',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.lrange.mockResolvedValueOnce([JSON.stringify(transaction)]);

      const result = await queue.peek();

      expect(result).toEqual(transaction);
      expect(mockRedis.lrange).toHaveBeenCalledWith(`queue:${testQueueName}:HIGH`, 0, 0);
      expect(mockRedis.lpop).not.toHaveBeenCalled();
    });

    it('should check all priority queues in order', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-peek-low',
        priority: TransactionPriority.LOW,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.lrange
        .mockResolvedValueOnce([]) // HIGH empty
        .mockResolvedValueOnce([]) // MEDIUM empty
        .mockResolvedValueOnce([JSON.stringify(transaction)]);

      const result = await queue.peek();

      expect(result).toEqual(transaction);
      expect(mockRedis.lrange).toHaveBeenCalledTimes(3);
    });

    it('should return null when all queues are empty', async () => {
      mockRedis.lrange.mockResolvedValue([]);

      const result = await queue.peek();

      expect(result).toBeNull();
    });
  });

  describe('size', () => {
    it('should return total size across all priority queues', async () => {
      mockRedis.llen
        .mockResolvedValueOnce(5)  // HIGH
        .mockResolvedValueOnce(10) // MEDIUM
        .mockResolvedValueOnce(15); // LOW

      const size = await queue.size();

      expect(size).toBe(30);
      expect(mockRedis.llen).toHaveBeenCalledTimes(3);
    });

    it('should return size for specific priority', async () => {
      mockRedis.llen.mockResolvedValueOnce(7);

      const size = await queue.size(TransactionPriority.HIGH);

      expect(size).toBe(7);
      expect(mockRedis.llen).toHaveBeenCalledWith(`queue:${testQueueName}:HIGH`);
      expect(mockRedis.llen).toHaveBeenCalledTimes(1);
    });

    it('should handle Redis errors', async () => {
      mockRedis.llen.mockRejectedValue(new Error('Redis error'));

      const size = await queue.size();

      expect(size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all priority queues', async () => {
      await queue.clear();

      expect(mockRedis.del).toHaveBeenCalledWith(`queue:${testQueueName}:HIGH`);
      expect(mockRedis.del).toHaveBeenCalledWith(`queue:${testQueueName}:MEDIUM`);
      expect(mockRedis.del).toHaveBeenCalledWith(`queue:${testQueueName}:LOW`);
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });

    it('should clear specific priority queue', async () => {
      await queue.clear(TransactionPriority.MEDIUM);

      expect(mockRedis.del).toHaveBeenCalledWith(`queue:${testQueueName}:MEDIUM`);
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(queue.clear()).resolves.toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-update',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(transaction));

      await queue.updateStatus(transaction.id, TransactionStatus.COMPLETED);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `queue:${testQueueName}:tx:${transaction.id}`,
        86400,
        expect.stringContaining('"status":"COMPLETED"')
      );
    });

    it('should add error message when status is FAILED', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-fail',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(transaction));

      await queue.updateStatus(transaction.id, TransactionStatus.FAILED, 'Insufficient funds');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `queue:${testQueueName}:tx:${transaction.id}`,
        86400,
        expect.stringContaining('"error":"Insufficient funds"')
      );
    });

    it('should throw error if transaction not found', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      await expect(
        queue.updateStatus('non-existent', TransactionStatus.COMPLETED)
      ).rejects.toThrow('Transaction not found');
    });

    it('should add completedAt timestamp for terminal states', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-complete',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PROCESSING,
        createdAt: Date.now(),
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(transaction));

      await queue.updateStatus(transaction.id, TransactionStatus.COMPLETED);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `queue:${testQueueName}:tx:${transaction.id}`,
        86400,
        expect.stringContaining('"completedAt":')
      );
    });
  });

  describe('concurrent access and locking', () => {
    it('should acquire lock before critical operations', async () => {
      const lockKey = `queue:${testQueueName}:lock`;
      mockRedis.set.mockImplementation((key, value, options) => {
        if (key === lockKey && options?.nx === true) {
          return Promise.resolve('OK');
        }
        return Promise.resolve('OK');
      });

      const transaction: QueuedTransaction = {
        id: 'tx-lock',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await queue.enqueue(transaction);

      expect(mockRedis.set).toHaveBeenCalledWith(
        lockKey,
        expect.any(String),
        { nx: true, ex: 10 }
      );
    });

    it('should retry acquiring lock with backoff', async () => {
      const lockKey = `queue:${testQueueName}:lock`;
      let attempts = 0;
      
      mockRedis.set.mockImplementation((key, value, options) => {
        if (key === lockKey && options?.nx === true) {
          attempts++;
          if (attempts <= 2) {
            return Promise.resolve(null); // Lock held by another process
          }
          return Promise.resolve('OK');
        }
        return Promise.resolve('OK');
      });

      const transaction: QueuedTransaction = {
        id: 'tx-retry',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await queue.enqueue(transaction);

      expect(attempts).toBe(3);
    });

    it('should release lock after operation', async () => {
      const lockKey = `queue:${testQueueName}:lock`;
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const transaction: QueuedTransaction = {
        id: 'tx-release',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await queue.enqueue(transaction);

      expect(mockRedis.del).toHaveBeenCalledWith(lockKey);
    });

    it('should release lock even if operation fails', async () => {
      const lockKey = `queue:${testQueueName}:lock`;
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.rpush.mockRejectedValue(new Error('Operation failed'));
      mockRedis.del.mockResolvedValue(1);

      const transaction: QueuedTransaction = {
        id: 'tx-fail-release',
        priority: TransactionPriority.MEDIUM,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await expect(queue.enqueue(transaction)).rejects.toThrow('Operation failed');
      expect(mockRedis.del).toHaveBeenCalledWith(lockKey);
    });

    it('should timeout if lock cannot be acquired', async () => {
      const lockKey = `queue:${testQueueName}:lock`;
      queue = new TransactionQueue(testQueueName, { lockTimeout: 100, lockRetryDelay: 10 });
      
      mockRedis.set.mockImplementation((key, value, options) => {
        if (key === lockKey && options?.nx === true) {
          return Promise.resolve(null); // Always locked
        }
        return Promise.resolve('OK');
      });

      const transaction: QueuedTransaction = {
        id: 'tx-timeout',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await expect(queue.enqueue(transaction)).rejects.toThrow('Failed to acquire lock');
    });
  });

  describe('persistence and recovery', () => {
    it('should persist queue state to Redis', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-persist',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await queue.enqueue(transaction);

      expect(mockRedis.lpush).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `queue:${testQueueName}:tx:${transaction.id}`,
        86400,
        JSON.stringify(transaction)
      );
    });

    it('should recover queue state after restart', async () => {
      const transactions = [
        {
          id: 'tx-1',
          priority: TransactionPriority.HIGH,
          data: { type: 'test1' },
          status: TransactionStatus.PENDING,
          createdAt: Date.now() - 1000,
        },
        {
          id: 'tx-2',
          priority: TransactionPriority.HIGH,
          data: { type: 'test2' },
          status: TransactionStatus.PENDING,
          createdAt: Date.now(),
        },
      ];

      mockRedis.lrange.mockResolvedValueOnce(
        transactions.map(tx => JSON.stringify(tx))
      );

      const items = await queue.getAllItems(TransactionPriority.HIGH);

      expect(items).toEqual(transactions);
    });

    it('should handle corrupted data during recovery', async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({ id: 'tx-1', priority: TransactionPriority.HIGH }),
        'corrupted-data',
        JSON.stringify({ id: 'tx-3', priority: TransactionPriority.HIGH }),
      ]);

      const items = await queue.getAllItems(TransactionPriority.HIGH);

      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('tx-1');
      expect(items[1].id).toBe('tx-3');
    });
  });

  describe('queue overflow handling', () => {
    it('should enforce max queue size', async () => {
      queue = new TransactionQueue(testQueueName, { maxQueueSize: 2 });
      mockRedis.llen.mockResolvedValue(2);

      const transaction: QueuedTransaction = {
        id: 'tx-overflow',
        priority: TransactionPriority.MEDIUM,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await expect(queue.enqueue(transaction)).rejects.toThrow('Queue size limit exceeded');
    });

    it('should allow different size limits per priority', async () => {
      queue = new TransactionQueue(testQueueName, {
        maxQueueSizePerPriority: {
          [TransactionPriority.HIGH]: 100,
          [TransactionPriority.MEDIUM]: 50,
          [TransactionPriority.LOW]: 20,
        },
      });

      mockRedis.llen.mockResolvedValue(50);

      const transaction: QueuedTransaction = {
        id: 'tx-medium-full',
        priority: TransactionPriority.MEDIUM,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await expect(queue.enqueue(transaction)).rejects.toThrow('Queue size limit exceeded for priority MEDIUM');
    });

    it('should provide queue metrics', async () => {
      mockRedis.llen
        .mockResolvedValueOnce(10) // HIGH
        .mockResolvedValueOnce(20) // MEDIUM
        .mockResolvedValueOnce(30); // LOW

      const metrics = await queue.getMetrics();

      expect(metrics).toEqual({
        total: 60,
        byPriority: {
          HIGH: 10,
          MEDIUM: 20,
          LOW: 30,
        },
        oldestTransaction: null,
        processingTime: {
          average: 0,
          p95: 0,
          p99: 0,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors', async () => {
      mockRedis.lpush.mockRejectedValue(new Error('Connection refused'));

      const transaction: QueuedTransaction = {
        id: 'tx-conn-error',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      };

      await expect(queue.enqueue(transaction)).rejects.toThrow('Connection refused');
    });

    it('should validate transaction structure', async () => {
      const invalidTransactions = [
        { priority: TransactionPriority.HIGH }, // Missing required fields
        { id: '', priority: TransactionPriority.HIGH, data: {} }, // Empty id
        { id: 'tx-1', priority: 'INVALID', data: {} }, // Invalid priority
        { id: 'tx-2', priority: TransactionPriority.HIGH }, // Missing data
      ];

      for (const tx of invalidTransactions) {
        await expect(
          queue.enqueue(tx as QueuedTransaction)
        ).rejects.toThrow(/Invalid transaction/);
      }
    });

    it('should handle transaction timeout', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-timeout',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PROCESSING,
        createdAt: Date.now() - 3600000, // 1 hour ago
        timeout: 1800000, // 30 minutes
      };

      // Mock transaction exists with correct timeout handling
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(transaction)) // First call in getTransactionStatus
        .mockResolvedValueOnce(JSON.stringify(transaction)); // Second call in updateStatus
      
      const status = await queue.getTransactionStatus(transaction.id);
      expect(status).toBe(TransactionStatus.FAILED);
    });
  });

  describe('FIFO ordering within priority', () => {
    it('should maintain FIFO order for same priority', async () => {
      const transactions = Array.from({ length: 5 }, (_, i) => ({
        id: `tx-${i}`,
        priority: TransactionPriority.MEDIUM,
        data: { order: i },
        status: TransactionStatus.PENDING,
        createdAt: Date.now() + i,
      }));

      for (const tx of transactions) {
        await queue.enqueue(tx);
      }

      // Verify all were added with rpush (FIFO)
      expect(mockRedis.rpush).toHaveBeenCalledTimes(5);
      
      // Mock dequeue responses in order
      mockRedis.lpop
        .mockResolvedValueOnce(null) // HIGH empty
        .mockResolvedValueOnce(JSON.stringify(transactions[0]))
        .mockResolvedValueOnce(null) // HIGH empty  
        .mockResolvedValueOnce(JSON.stringify(transactions[1]))
        .mockResolvedValueOnce(null) // HIGH empty
        .mockResolvedValueOnce(JSON.stringify(transactions[2]));

      const first = await queue.dequeue();
      const second = await queue.dequeue();
      const third = await queue.dequeue();

      expect(first?.data.order).toBe(0);
      expect(second?.data.order).toBe(1);
      expect(third?.data.order).toBe(2);
    });
  });

  describe('batch operations', () => {
    it('should support batch enqueue', async () => {
      const transactions = Array.from({ length: 3 }, (_, i) => ({
        id: `tx-batch-${i}`,
        priority: TransactionPriority.MEDIUM,
        data: { batch: true, index: i },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      }));

      await queue.enqueueBatch(transactions);

      expect(mockRedis.multi).toHaveBeenCalled();
    });

    it('should support batch dequeue', async () => {
      const transactions = Array.from({ length: 3 }, (_, i) => ({
        id: `tx-batch-${i}`,
        priority: TransactionPriority.HIGH,
        data: { batch: true, index: i },
        status: TransactionStatus.PENDING,
        createdAt: Date.now(),
      }));

      mockRedis.lrange.mockResolvedValueOnce(
        transactions.slice(0, 2).map(tx => JSON.stringify(tx))
      );

      const batch = await queue.dequeueBatch(2);

      expect(batch).toHaveLength(2);
      expect(batch[0].id).toBe('tx-batch-0');
      expect(batch[1].id).toBe('tx-batch-1');
    });
  });

  describe('dead letter queue', () => {
    it('should move failed transactions to dead letter queue', async () => {
      const transaction: QueuedTransaction = {
        id: 'tx-dead',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.PROCESSING,
        createdAt: Date.now(),
        retryCount: 3,
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(transaction));

      await queue.updateStatus(transaction.id, TransactionStatus.FAILED, 'Max retries exceeded');

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        `queue:${testQueueName}:dead-letter`,
        expect.stringContaining('tx-dead')
      );
    });

    it('should be able to reprocess dead letter queue items', async () => {
      const deadTransaction: QueuedTransaction = {
        id: 'tx-reprocess',
        priority: TransactionPriority.HIGH,
        data: { type: 'test' },
        status: TransactionStatus.FAILED,
        createdAt: Date.now(),
        error: 'Previous failure',
      };

      mockRedis.lpop.mockResolvedValueOnce(JSON.stringify(deadTransaction));

      const reprocessed = await queue.reprocessDeadLetter();

      expect(reprocessed).toBeTruthy();
      expect(reprocessed?.status).toBe(TransactionStatus.PENDING);
      expect(reprocessed?.retryCount).toBe(1);
    });
  });
});