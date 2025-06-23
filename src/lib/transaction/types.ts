/**
 * Transaction priority levels for queue processing
 */
export enum TransactionPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * Transaction processing status
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Transaction types supported by the system
 */
export enum TransactionType {
  TOKEN_DEPLOYMENT = 'token_deployment',
  TOKEN_TRANSFER = 'token_transfer',
  WALLET_CONNECTION = 'wallet_connection',
  METADATA_UPDATE = 'metadata_update',
}

/**
 * Base transaction interface for queued transactions
 */
export interface QueuedTransaction {
  /** Unique transaction identifier */
  id: string;
  /** Priority level for processing order */
  priority: TransactionPriority;
  /** Transaction-specific data payload */
  data: Record<string, unknown>;
  /** Current processing status */
  status: TransactionStatus;
  /** Timestamp when transaction was created */
  createdAt: number;
  /** Timestamp when transaction was last updated */
  updatedAt?: number;
  /** Timestamp when transaction was completed */
  completedAt?: number;
  /** Error message if transaction failed */
  error?: string;
  /** Number of retry attempts */
  retryCount?: number;
  /** Custom timeout in milliseconds */
  timeout?: number;
}

/**
 * Configuration options for TransactionQueue
 */
export interface TransactionQueueOptions {
  /** Maximum total queue size across all priorities */
  maxQueueSize?: number;
  /** Maximum queue size per priority level */
  maxQueueSizePerPriority?: Record<TransactionPriority, number>;
  /** Timeout for acquiring locks in milliseconds */
  lockTimeout?: number;
  /** Delay between lock retry attempts in milliseconds */
  lockRetryDelay?: number;
  /** Time-to-live for transactions in seconds */
  transactionTTL?: number;
}

/**
 * Queue metrics for monitoring and observability
 */
export interface QueueMetrics {
  /** Total number of transactions across all priorities */
  total: number;
  /** Number of transactions by priority */
  byPriority: Record<TransactionPriority, number>;
  /** Oldest transaction in the queue */
  oldestTransaction: QueuedTransaction | null;
  /** Processing time statistics */
  processingTime: {
    /** Average processing time in milliseconds */
    average: number;
    /** 95th percentile processing time */
    p95: number;
    /** 99th percentile processing time */
    p99: number;
  };
}

/**
 * Transaction data structure for TransactionManager
 */
export interface Transaction {
  /** Transaction type identifier */
  type: string;
  /** Transaction payload data */
  payload: Record<string, unknown>;
}

/**
 * Transaction metadata for tracking and filtering
 */
export interface TransactionMetadata {
  /** User ID associated with the transaction */
  userId: number;
  /** Human-readable description */
  description?: string;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Priority levels for TransactionManager (string literals)
 */
export type Priority = 'high' | 'medium' | 'low';

/**
 * Transaction status for TransactionManager (string literals)
 */
export type Status = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Transaction processor function signature
 */
export type TransactionProcessor = (transaction: Transaction) => Promise<ProcessorResult>;

/**
 * Result returned by transaction processor
 */
export interface ProcessorResult {
  /** Whether processing was successful */
  success: boolean;
  /** Result data if successful */
  result?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Configuration for TransactionManager
 */
export interface TransactionManagerConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  /** Transaction processor function */
  processor: TransactionProcessor;
  /** Optional Redis instance */
  redis?: unknown;
}

/**
 * Transaction history record
 */
export interface TransactionHistoryRecord {
  /** Transaction ID */
  id: string;
  /** Transaction type */
  type: string;
  /** Processing status */
  status: Status;
  /** Creation timestamp */
  createdAt: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Error message if failed */
  error?: string;
  /** Transaction result if completed */
  result?: unknown;
}

/**
 * Options for filtering transaction history
 */
export interface TransactionHistoryOptions {
  /** Filter by status */
  status?: Status;
  /** Filter by type */
  type?: string;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Bulk transaction input
 */
export interface BulkTransactionInput {
  /** Transaction data */
  transaction: Transaction;
  /** Transaction metadata */
  metadata: TransactionMetadata;
  /** Processing priority */
  priority: Priority;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  /** Transaction ID */
  txId: string;
  /** Whether operation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Transaction metrics for monitoring
 */
export interface TransactionMetrics {
  /** Number of queued transactions */
  queuedTransactions: number;
  /** Number of currently processing transactions */
  processingTransactions: number;
  /** Number of completed transactions */
  completedTransactions: number;
  /** Number of failed transactions */
  failedTransactions: number;
  /** Total number of transactions */
  totalTransactions: number;
}

/**
 * Transaction statistics by type
 */
export interface TransactionStats {
  /** Count of transactions by type */
  byType: Record<string, number>;
  /** Total transaction count */
  total: number;
}

/**
 * Error types for transaction processing
 */
export enum TransactionErrorType {
  /** Validation errors that should not be retried */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Network errors that can be retried */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Timeout errors */
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  /** Rate limit errors */
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  /** Unknown errors */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Transaction error with categorization
 */
export interface TransactionError extends Error {
  /** Error type for retry logic */
  type: TransactionErrorType;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Original error if wrapped */
  originalError?: Error;
}

/**
 * Status update event for subscriptions
 */
export interface StatusUpdateEvent {
  /** New status */
  status: Status;
  /** Timestamp of the update */
  timestamp: number;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Unsubscribe function returned by subscriptions
 */
export type UnsubscribeFn = () => Promise<void>;