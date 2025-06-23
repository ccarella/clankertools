// Mock TransactionManager
export const mockTransactionManager = {
  queueTransaction: jest.fn(),
  startAutoProcessing: jest.fn(),
  stopAutoProcessing: jest.fn(),
  cancelTransaction: jest.fn(),
  getUserTransactionHistory: jest.fn(),
  subscribeToTransaction: jest.fn(),
  getMetrics: jest.fn(),
  getTransactionStats: jest.fn(),
  cleanupOldTransactions: jest.fn(),
  bulkQueueTransactions: jest.fn(),
  bulkCancelTransactions: jest.fn(),
};

// Mock the static methods
export const TransactionManager = {
  getInstance: jest.fn().mockReturnValue(mockTransactionManager),
  resetInstance: jest.fn(),
  hasInstance: jest.fn().mockReturnValue(true),
};

// Mock the getTransactionManager function
export const getTransactionManager = jest.fn().mockReturnValue(mockTransactionManager);

// Re-export types
export * from '@/lib/transaction/TransactionManager';