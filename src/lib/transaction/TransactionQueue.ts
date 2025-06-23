import { getRedisClient } from '../redis'
import type { Redis } from '@upstash/redis'
import {
  TransactionPriority,
  TransactionStatus,
  type QueuedTransaction,
  type TransactionQueueOptions,
  type QueueMetrics,
} from './types'

// Re-export types for backward compatibility
export {
  TransactionPriority,
  TransactionStatus,
  type QueuedTransaction,
  type TransactionQueueOptions,
  type QueueMetrics,
}

const DEFAULT_OPTIONS: Required<TransactionQueueOptions> = {
  maxQueueSize: Number.MAX_SAFE_INTEGER,
  maxQueueSizePerPriority: {
    [TransactionPriority.HIGH]: Number.MAX_SAFE_INTEGER,
    [TransactionPriority.MEDIUM]: Number.MAX_SAFE_INTEGER,
    [TransactionPriority.LOW]: Number.MAX_SAFE_INTEGER,
  },
  lockTimeout: 5000,
  lockRetryDelay: 50,
  transactionTTL: 86400, // 24 hours
}

export class TransactionQueue {
  private redis: Redis
  private options: Required<TransactionQueueOptions>

  constructor(public queueName: string, options?: TransactionQueueOptions) {
    this.redis = getRedisClient()
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  private getQueueKey(priority: TransactionPriority): string {
    return `queue:${this.queueName}:${priority}`
  }

  private getTransactionKey(id: string): string {
    return `queue:${this.queueName}:tx:${id}`
  }

  private getLockKey(): string {
    return `queue:${this.queueName}:lock`
  }

  private getDeadLetterKey(): string {
    return `queue:${this.queueName}:dead-letter`
  }

  private async acquireLock(lockId: string): Promise<boolean> {
    const lockKey = this.getLockKey()
    const startTime = Date.now()

    while (Date.now() - startTime < this.options.lockTimeout) {
      const acquired = await this.redis.set(lockKey, lockId, {
        nx: true,
        ex: 10, // Lock expires after 10 seconds
      })

      if (acquired === 'OK') {
        return true
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.options.lockRetryDelay))
    }

    throw new Error('Failed to acquire lock')
  }

  private async releaseLock(): Promise<void> {
    await this.redis.del(this.getLockKey())
  }

  private validateTransaction(transaction: QueuedTransaction): void {
    if (!transaction.id || typeof transaction.id !== 'string') {
      throw new Error('Invalid transaction: missing id')
    }

    if (!transaction.priority || !Object.values(TransactionPriority).includes(transaction.priority)) {
      throw new Error('Invalid transaction: invalid priority')
    }

    if (!transaction.data || typeof transaction.data !== 'object') {
      throw new Error('Invalid transaction: missing data')
    }

    if (!transaction.status || !Object.values(TransactionStatus).includes(transaction.status)) {
      throw new Error('Invalid transaction: invalid status')
    }

    if (typeof transaction.createdAt !== 'number') {
      throw new Error('Invalid transaction: invalid createdAt')
    }
  }

  async enqueue(transaction: QueuedTransaction): Promise<void> {
    this.validateTransaction(transaction)

    const lockId = `${transaction.id}-${Date.now()}`
    const lockAcquired = await this.acquireLock(lockId)

    try {
      // Check queue size limits
      const totalSize = await this.size()
      if (totalSize >= this.options.maxQueueSize) {
        throw new Error('Queue size limit exceeded')
      }

      const prioritySize = await this.size(transaction.priority)
      const priorityLimit = this.options.maxQueueSizePerPriority[transaction.priority]
      if (prioritySize >= priorityLimit) {
        throw new Error(`Queue size limit exceeded for priority ${transaction.priority}`)
      }

      // Store transaction metadata
      await this.redis.setex(
        this.getTransactionKey(transaction.id),
        this.options.transactionTTL,
        JSON.stringify(transaction)
      )

      // Add to appropriate queue
      const queueKey = this.getQueueKey(transaction.priority)
      if (transaction.priority === TransactionPriority.HIGH) {
        await this.redis.lpush(queueKey, JSON.stringify(transaction))
      } else {
        await this.redis.rpush(queueKey, JSON.stringify(transaction))
      }
    } finally {
      if (lockAcquired) {
        await this.releaseLock()
      }
    }
  }

  async dequeue(): Promise<QueuedTransaction | null> {
    // Try priorities in order: HIGH, MEDIUM, LOW
    const priorities = [TransactionPriority.HIGH, TransactionPriority.MEDIUM, TransactionPriority.LOW]

    for (const priority of priorities) {
      const queueKey = this.getQueueKey(priority)
      const item = await this.redis.lpop<string>(queueKey)

      if (item) {
        try {
          const transaction = JSON.parse(item) as QueuedTransaction
          
          // Update status to PROCESSING
          transaction.status = TransactionStatus.PROCESSING
          transaction.updatedAt = Date.now()

          // Update in Redis
          await this.redis.setex(
            this.getTransactionKey(transaction.id),
            this.options.transactionTTL,
            JSON.stringify(transaction)
          )

          return transaction
        } catch {
          // Invalid JSON, continue to next item
          continue
        }
      }
    }

    return null
  }

  async peek(): Promise<QueuedTransaction | null> {
    // Try priorities in order: HIGH, MEDIUM, LOW
    const priorities = [TransactionPriority.HIGH, TransactionPriority.MEDIUM, TransactionPriority.LOW]

    for (const priority of priorities) {
      const queueKey = this.getQueueKey(priority)
      const items = await this.redis.lrange<string>(queueKey, 0, 0)

      if (items && items.length > 0) {
        try {
          return JSON.parse(items[0]) as QueuedTransaction
        } catch {
          // Invalid JSON, continue to next priority
          continue
        }
      }
    }

    return null
  }

  async size(priority?: TransactionPriority): Promise<number> {
    try {
      if (priority) {
        const queueKey = this.getQueueKey(priority)
        return await this.redis.llen(queueKey)
      }

      // Get total size across all priorities
      let total = 0
      const priorities = Object.values(TransactionPriority)
      
      for (const p of priorities) {
        const queueKey = this.getQueueKey(p)
        const size = await this.redis.llen(queueKey)
        total += size
      }

      return total
    } catch {
      // Handle Redis errors gracefully
      return 0
    }
  }

  async clear(priority?: TransactionPriority): Promise<void> {
    try {
      if (priority) {
        await this.redis.del(this.getQueueKey(priority))
      } else {
        // Clear all priority queues
        const priorities = Object.values(TransactionPriority)
        for (const p of priorities) {
          await this.redis.del(this.getQueueKey(p))
        }
      }
    } catch {
      // Handle Redis errors gracefully
    }
  }

  async updateStatus(id: string, status: TransactionStatus, error?: string): Promise<void> {
    const txKey = this.getTransactionKey(id)
    const txData = await this.redis.get<string>(txKey)

    if (!txData) {
      throw new Error('Transaction not found')
    }

    const transaction = JSON.parse(txData) as QueuedTransaction
    transaction.status = status
    transaction.updatedAt = Date.now()

    if (error) {
      transaction.error = error
    }

    // Add completedAt for terminal states
    if (status === TransactionStatus.COMPLETED || status === TransactionStatus.FAILED) {
      transaction.completedAt = Date.now()

      // Move to dead letter queue if failed with max retries
      if (status === TransactionStatus.FAILED && transaction.retryCount && transaction.retryCount >= 3) {
        await this.redis.rpush(this.getDeadLetterKey(), JSON.stringify(transaction))
      }
    }

    await this.redis.setex(txKey, this.options.transactionTTL, JSON.stringify(transaction))
  }

  async getAllItems(priority: TransactionPriority): Promise<QueuedTransaction[]> {
    const queueKey = this.getQueueKey(priority)
    const items = await this.redis.lrange<string>(queueKey, 0, -1)

    const transactions: QueuedTransaction[] = []
    for (const item of items) {
      try {
        transactions.push(JSON.parse(item) as QueuedTransaction)
      } catch {
        // Skip corrupted data
        continue
      }
    }

    return transactions
  }

  async getMetrics(): Promise<QueueMetrics> {
    const byPriority: Record<TransactionPriority, number> = {
      [TransactionPriority.HIGH]: 0,
      [TransactionPriority.MEDIUM]: 0,
      [TransactionPriority.LOW]: 0,
    }

    let total = 0
    for (const priority of Object.values(TransactionPriority)) {
      const size = await this.size(priority)
      byPriority[priority] = size
      total += size
    }

    // Find oldest transaction across all queues
    let oldestTransaction: QueuedTransaction | null = null
    for (const priority of Object.values(TransactionPriority)) {
      const items = await this.getAllItems(priority)
      for (const item of items) {
        if (!oldestTransaction || item.createdAt < oldestTransaction.createdAt) {
          oldestTransaction = item
        }
      }
    }

    return {
      total,
      byPriority,
      oldestTransaction,
      processingTime: {
        average: 0,
        p95: 0,
        p99: 0,
      },
    }
  }

  async getTransactionStatus(id: string): Promise<TransactionStatus | null> {
    const txKey = this.getTransactionKey(id)
    const txData = await this.redis.get<string>(txKey)

    if (!txData) {
      return null
    }

    const transaction = JSON.parse(txData) as QueuedTransaction

    // Check for timeout
    if (
      transaction.status === TransactionStatus.PROCESSING &&
      transaction.timeout &&
      transaction.createdAt + transaction.timeout < Date.now()
    ) {
      // Update status to FAILED due to timeout
      await this.updateStatus(id, TransactionStatus.FAILED, 'Transaction timed out')
      return TransactionStatus.FAILED
    }

    return transaction.status
  }

  async enqueueBatch(transactions: QueuedTransaction[]): Promise<void> {
    // Validate all transactions first
    for (const tx of transactions) {
      this.validateTransaction(tx)
    }

    const lockId = `batch-${Date.now()}`
    const lockAcquired = await this.acquireLock(lockId)

    try {
      // Use Redis multi for atomic batch operation
      const multi = this.redis.multi()

      for (const tx of transactions) {
        // Store transaction metadata
        multi.setex(
          this.getTransactionKey(tx.id),
          this.options.transactionTTL,
          JSON.stringify(tx)
        )

        // Add to appropriate queue
        const queueKey = this.getQueueKey(tx.priority)
        if (tx.priority === TransactionPriority.HIGH) {
          multi.lpush(queueKey, JSON.stringify(tx))
        } else {
          multi.rpush(queueKey, JSON.stringify(tx))
        }
      }

      await multi.exec()
    } finally {
      if (lockAcquired) {
        await this.releaseLock()
      }
    }
  }

  async dequeueBatch(count: number): Promise<QueuedTransaction[]> {
    const transactions: QueuedTransaction[] = []
    const priorities = [TransactionPriority.HIGH, TransactionPriority.MEDIUM, TransactionPriority.LOW]

    for (const priority of priorities) {
      if (transactions.length >= count) break

      const queueKey = this.getQueueKey(priority)
      const remaining = count - transactions.length
      const items = await this.redis.lrange<string>(queueKey, 0, remaining - 1)

      for (const item of items) {
        try {
          const tx = JSON.parse(item) as QueuedTransaction
          transactions.push(tx)
        } catch {
          // Skip invalid items
          continue
        }
      }

      // Remove dequeued items
      if (items.length > 0) {
        await this.redis.ltrim(queueKey, items.length, -1)
      }
    }

    // Update status for all dequeued transactions
    for (const tx of transactions) {
      tx.status = TransactionStatus.PROCESSING
      tx.updatedAt = Date.now()
      await this.redis.setex(
        this.getTransactionKey(tx.id),
        this.options.transactionTTL,
        JSON.stringify(tx)
      )
    }

    return transactions
  }

  async reprocessDeadLetter(): Promise<QueuedTransaction | null> {
    const deadLetterKey = this.getDeadLetterKey()
    const item = await this.redis.lpop<string>(deadLetterKey)

    if (!item) {
      return null
    }

    try {
      const transaction = JSON.parse(item) as QueuedTransaction
      
      // Reset for reprocessing
      transaction.status = TransactionStatus.PENDING
      transaction.updatedAt = Date.now()
      transaction.retryCount = (transaction.retryCount || 0) + 1
      delete transaction.error
      delete transaction.completedAt

      // Re-enqueue the transaction
      await this.enqueue(transaction)

      return transaction
    } catch {
      return null
    }
  }
}