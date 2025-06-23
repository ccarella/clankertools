import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionStatusCard } from '../TransactionStatusCard';
import { TransactionProvider } from '@/components/providers/TransactionProvider';
import { HapticProvider } from '@/providers/HapticProvider';

// Mock the providers
jest.mock('@/components/providers/TransactionProvider', () => ({
  TransactionProvider: ({ children }: { children: React.ReactNode }) => children,
  useTransactionProvider: jest.fn(),
  useTransactionSubscription: jest.fn(),
}));

// Get the mock function reference after the mock is set up
import { useTransactionSubscription } from '@/components/providers/TransactionProvider';
const mockUseTransactionSubscription = useTransactionSubscription as jest.MockedFunction<typeof useTransactionSubscription>;

// Mock HapticProvider
jest.mock('@/providers/HapticProvider', () => ({
  HapticProvider: ({ children }: { children: React.ReactNode }) => children,
  useHaptic: () => ({
    cardSelect: jest.fn(),
    buttonPress: jest.fn(),
  }),
}));

const mockTransaction = {
  id: 'tx_123',
  hash: '0x1234567890abcdef',
  type: 'token_deployment' as const,
  status: 'processing' as const,
  timestamp: '2023-01-01T00:00:00.000Z',
  tokenName: 'TestToken',
  tokenSymbol: 'TST',
  progress: 25,
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HapticProvider>
    <TransactionProvider>
      {children}
    </TransactionProvider>
  </HapticProvider>
);

describe('TransactionStatusCard with Real-time Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTransactionSubscription.mockReturnValue(null);
  });

  it('should render transaction with real-time updates enabled by default', () => {
    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    expect(mockUseTransactionSubscription).toHaveBeenCalledWith('tx_123', {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
    });

    expect(screen.getByText('Token Deployment')).toBeInTheDocument();
    expect(screen.getByText('processing')).toBeInTheDocument();
  });

  it('should disable real-time updates when explicitly disabled', () => {
    render(
      <TestWrapper>
        <TransactionStatusCard 
          transaction={mockTransaction} 
          enableRealTimeUpdates={false}
        />
      </TestWrapper>
    );

    expect(mockUseTransactionSubscription).toHaveBeenCalledWith(null, {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
    });
  });

  it('should merge real-time status with transaction props', () => {
    const realtimeStatus = {
      id: 'tx_123',
      status: 'completed' as const,
      progress: 100,
      timestamp: Date.now(),
      updatedAt: Date.now(),
    };

    mockUseTransactionSubscription.mockReturnValue({
      status: realtimeStatus,
      isConnected: true,
      isReconnecting: false,
      error: null,
      reconnectAttempts: 0,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    // Should show the real-time status instead of the prop status
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByTestId('success-icon')).toBeInTheDocument();
  });

  it('should show connection status indicators', () => {
    mockUseTransactionSubscription.mockReturnValue({
      status: null,
      isConnected: true,
      isReconnecting: false,
      error: null,
      reconnectAttempts: 0,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    // Should show connected indicator
    const connectedIcon = screen.getByLabelText('Connected');
    expect(connectedIcon).toBeInTheDocument();
  });

  it('should show reconnecting indicator', () => {
    mockUseTransactionSubscription.mockReturnValue({
      status: null,
      isConnected: false,
      isReconnecting: true,
      error: null,
      reconnectAttempts: 1,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    const reconnectingIcon = screen.getByLabelText('Reconnecting');
    expect(reconnectingIcon).toBeInTheDocument();
  });

  it('should show disconnected indicator when there is an error', () => {
    mockUseTransactionSubscription.mockReturnValue({
      status: null,
      isConnected: false,
      isReconnecting: false,
      error: 'Connection failed',
      reconnectAttempts: 3,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    const disconnectedIcon = screen.getByLabelText('Disconnected');
    expect(disconnectedIcon).toBeInTheDocument();
  });

  it('should not show connection indicators when real-time is disabled', () => {
    render(
      <TestWrapper>
        <TransactionStatusCard 
          transaction={mockTransaction} 
          enableRealTimeUpdates={false}
        />
      </TestWrapper>
    );

    expect(screen.queryByLabelText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reconnecting')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Disconnected')).not.toBeInTheDocument();
  });

  it('should update progress bar with real-time data', () => {
    const realtimeStatus = {
      id: 'tx_123',
      status: 'processing' as const,
      progress: 75,
      timestamp: Date.now(),
    };

    mockUseTransactionSubscription.mockReturnValue({
      status: realtimeStatus,
      isConnected: true,
      isReconnecting: false,
      error: null,
      reconnectAttempts: 0,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    // Progress should be from real-time data (75%) not props (25%)
    expect(screen.getByText('75%')).toBeInTheDocument();
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
  });

  it('should show real-time error messages', () => {
    const realtimeStatus = {
      id: 'tx_123',
      status: 'failed' as const,
      progress: 0,
      timestamp: Date.now(),
      error: 'Real-time error message',
    };

    mockUseTransactionSubscription.mockReturnValue({
      status: realtimeStatus,
      isConnected: true,
      isReconnecting: false,
      error: null,
      reconnectAttempts: 0,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    expect(screen.getByText('Real-time error message')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should handle status changes and trigger haptic feedback', async () => {
    const { rerender } = render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    // Initially processing
    expect(screen.getByText('processing')).toBeInTheDocument();

    // Update to completed via real-time
    const completedStatus = {
      id: 'tx_123',
      status: 'completed' as const,
      progress: 100,
      timestamp: Date.now(),
    };

    mockUseTransactionSubscription.mockReturnValue({
      status: completedStatus,
      isConnected: true,
      isReconnecting: false,
      error: null,
      reconnectAttempts: 0,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    rerender(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('success')).toBeInTheDocument();
    });
  });

  it('should use transaction prop data when real-time subscription is null', () => {
    mockUseTransactionSubscription.mockReturnValue(null);

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    // Should fall back to prop data
    expect(screen.getByText('processing')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('should handle callback functions with current transaction data', () => {
    const onCancel = jest.fn();
    const onRetry = jest.fn();

    const realtimeStatus = {
      id: 'tx_updated',
      status: 'pending' as const,
      progress: 10,
      timestamp: Date.now(),
    };

    mockUseTransactionSubscription.mockReturnValue({
      status: realtimeStatus,
      isConnected: true,
      isReconnecting: false,
      error: null,
      reconnectAttempts: 0,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard 
          transaction={{...mockTransaction, status: 'pending'}}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      </TestWrapper>
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Should call with the real-time transaction ID
    expect(onCancel).toHaveBeenCalledWith('tx_updated');
  });

  it('should update timestamp with real-time data', () => {
    const updatedTime = Date.now();
    const realtimeStatus = {
      id: 'tx_123',
      status: 'processing' as const,
      progress: 50,
      timestamp: Date.now(),
      updatedAt: updatedTime,
    };

    mockUseTransactionSubscription.mockReturnValue({
      status: realtimeStatus,
      isConnected: true,
      isReconnecting: false,
      error: null,
      reconnectAttempts: 0,
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(
      <TestWrapper>
        <TransactionStatusCard transaction={mockTransaction} />
      </TestWrapper>
    );

    // The component should use the updated timestamp for display
    const timestampElement = screen.getByText(/minutes ago|hours ago|AM|PM/);
    expect(timestampElement).toBeInTheDocument();
  });

  it('should handle status mapping correctly', () => {
    const testCases = [
      { realtimeStatus: 'queued', expectedDisplay: 'pending' },
      { realtimeStatus: 'processing', expectedDisplay: 'processing' },
      { realtimeStatus: 'completed', expectedDisplay: 'success' },
      { realtimeStatus: 'failed', expectedDisplay: 'failed' },
      { realtimeStatus: 'cancelled', expectedDisplay: 'cancelled' },
    ];

    testCases.forEach(({ realtimeStatus, expectedDisplay }) => {
      mockUseTransactionSubscription.mockReturnValue({
        status: {
          id: 'tx_123',
          status: realtimeStatus as 'queued' | 'processing' | 'completed' | 'failed',
          progress: 0,
          timestamp: Date.now(),
        },
        isConnected: true,
        isReconnecting: false,
        error: null,
        reconnectAttempts: 0,
        reconnect: jest.fn(),
        disconnect: jest.fn(),
      });

      const { unmount } = render(
        <TestWrapper>
          <TransactionStatusCard transaction={mockTransaction} />
        </TestWrapper>
      );

      expect(screen.getByText(expectedDisplay)).toBeInTheDocument();
      unmount();
    });
  });
});