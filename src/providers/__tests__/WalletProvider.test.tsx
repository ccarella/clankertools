import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletProvider, useWallet } from '../WalletProvider';
import sdk from '@farcaster/frame-sdk';

// Mock the Farcaster SDK
jest.mock('@farcaster/frame-sdk');
const mockSdk = sdk as any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Test component to access wallet context
const TestComponent = () => {
  const wallet = useWallet();
  return (
    <div>
      <div data-testid="wallet-status">
        {wallet.isConnected ? 'Connected' : 'Not Connected'}
      </div>
      <div data-testid="wallet-address">{wallet.address || 'No Address'}</div>
      <div data-testid="wallet-balance">{wallet.balance || '0'}</div>
      <div data-testid="wallet-chain-id">{wallet.chainId || 'No Chain'}</div>
      <div data-testid="wallet-loading">{wallet.isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="wallet-error">{wallet.error || 'No Error'}</div>
      <button onClick={wallet.connect} data-testid="connect-button">Connect</button>
      <button onClick={wallet.disconnect} data-testid="disconnect-button">Disconnect</button>
    </div>
  );
};

describe('WalletProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear sessionStorage before each test
    window.sessionStorage.clear();
    // Reset the mock
    mockSdk.wallet.getEthereumProvider.mockReset();
  });

  it('should provide initial wallet state', () => {
    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    expect(screen.getByTestId('wallet-status')).toHaveTextContent('Not Connected');
    expect(screen.getByTestId('wallet-address')).toHaveTextContent('No Address');
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent('0');
    expect(screen.getByTestId('wallet-chain-id')).toHaveTextContent('No Chain');
    expect(screen.getByTestId('wallet-loading')).toHaveTextContent('Not Loading');
    expect(screen.getByTestId('wallet-error')).toHaveTextContent('No Error');
  });

  it('should connect wallet successfully', async () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const mockChainId = 8453; // Base chain ID

    // Mock successful wallet connection
    const mockProvider = {
      request: jest.fn()
        .mockResolvedValueOnce([mockAddress]) // eth_requestAccounts
        .mockResolvedValueOnce('0x' + mockChainId.toString(16)), // eth_chainId
    };
    mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockProvider);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    const connectButton = screen.getByTestId('connect-button');

    await act(async () => {
      await userEvent.click(connectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected');
      expect(screen.getByTestId('wallet-address')).toHaveTextContent(mockAddress);
      expect(screen.getByTestId('wallet-chain-id')).toHaveTextContent('8453');
    });

    expect(mockSdk.wallet.getEthereumProvider).toHaveBeenCalledTimes(1);
    expect(mockProvider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(mockProvider.request).toHaveBeenCalledWith({ method: 'eth_chainId' });
  });

  it('should handle wallet connection error', async () => {
    const errorMessage = 'User rejected connection';

    // Mock failed wallet connection
    const mockProvider = {
      request: jest.fn().mockRejectedValue(new Error(errorMessage)),
    };
    mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockProvider);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    const connectButton = screen.getByTestId('connect-button');

    await act(async () => {
      await userEvent.click(connectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-status')).toHaveTextContent('Not Connected');
      expect(screen.getByTestId('wallet-error')).toHaveTextContent(errorMessage);
    });
  });

  it('should handle no provider available', async () => {
    // Mock no provider available
    mockSdk.wallet.getEthereumProvider.mockResolvedValue(undefined);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    const connectButton = screen.getByTestId('connect-button');

    await act(async () => {
      await userEvent.click(connectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-status')).toHaveTextContent('Not Connected');
      expect(screen.getByTestId('wallet-error')).toHaveTextContent('No Ethereum provider available');
    });
  });

  it('should disconnect wallet', async () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const mockChainId = 8453;

    const mockProvider = {
      request: jest.fn()
        .mockResolvedValueOnce([mockAddress])
        .mockResolvedValueOnce('0x' + mockChainId.toString(16)),
    };
    mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockProvider);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    // First connect
    await act(async () => {
      await userEvent.click(screen.getByTestId('connect-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected');
    });

    // Then disconnect
    await act(async () => {
      await userEvent.click(screen.getByTestId('disconnect-button'));
    });

    expect(screen.getByTestId('wallet-status')).toHaveTextContent('Not Connected');
    expect(screen.getByTestId('wallet-address')).toHaveTextContent('No Address');
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent('0');
  });

  it('should show loading state during connection', async () => {
    let resolveAccounts: (value: string[]) => void = () => {};
    const accountsPromise = new Promise<string[]>((resolve) => {
      resolveAccounts = resolve;
    });

    const mockProvider = {
      request: jest.fn().mockReturnValue(accountsPromise),
    };
    mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockProvider);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    const connectButton = screen.getByTestId('connect-button');

    act(() => {
      userEvent.click(connectButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-loading')).toHaveTextContent('Loading');
    });

    await act(async () => {
      resolveAccounts(['0x1234567890123456789012345678901234567890']);
      // Now mock the chainId response
      mockProvider.request.mockResolvedValueOnce('0x210d');
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-loading')).toHaveTextContent('Not Loading');
    });
  });

  it('should validate Base network (chainId 8453)', async () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const wrongChainId = 1; // Ethereum mainnet, not Base

    const mockProvider = {
      request: jest.fn()
        .mockResolvedValueOnce([mockAddress])
        .mockResolvedValueOnce('0x' + wrongChainId.toString(16)),
    };
    mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockProvider);

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId('connect-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-error')).toHaveTextContent('Please switch to Base network');
    });
  });

  it('should persist wallet state in sessionStorage', async () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    const mockChainId = 8453;

    const mockProvider = {
      request: jest.fn()
        .mockResolvedValueOnce([mockAddress])
        .mockResolvedValueOnce('0x' + mockChainId.toString(16)),
    };
    mockSdk.wallet.getEthereumProvider.mockResolvedValue(mockProvider);

    const { unmount } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await act(async () => {
      await userEvent.click(screen.getByTestId('connect-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected');
    });

    // Check sessionStorage
    const storedState = sessionStorage.getItem('wallet-state');
    expect(storedState).toBeTruthy();
    const parsedState = JSON.parse(storedState!);
    expect(parsedState.address).toBe(mockAddress);
    expect(parsedState.chainId).toBe(mockChainId);

    // Unmount and remount to test persistence
    unmount();

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    // Should restore state from sessionStorage
    expect(screen.getByTestId('wallet-status')).toHaveTextContent('Connected');
    expect(screen.getByTestId('wallet-address')).toHaveTextContent(mockAddress);
  });

  it('should throw error when useWallet is used outside of WalletProvider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useWallet must be used within a WalletProvider');

    console.error = originalError;
  });
});