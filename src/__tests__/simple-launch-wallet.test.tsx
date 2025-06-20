import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import SimpleLaunchPage from '@/app/simple-launch/page';
import { useWallet } from '@/providers/WalletProvider';
import { mockSDK as sdk } from '@/__mocks__/@farcaster/frame-sdk';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/providers/WalletProvider');
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: () => ({ triggerHaptic: jest.fn() }),
}));
jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn(() => ({
    user: {
      fid: 123,
      username: 'testuser',
      displayName: 'Test User',
      pfpUrl: 'https://example.com/pfp.jpg',
    },
    castContext: null,
  })),
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

// Mock fetch for config endpoint
global.fetch = jest.fn();

describe('SimpleLaunchPage - Wallet Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as ReturnType<typeof useRouter>);

    // Default wallet state - not connected
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      chainId: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnecting: false,
      error: null,
    });

    // Mock Farcaster SDK context
    (sdk.context.get as jest.Mock).mockResolvedValue({
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.jpg',
      },
    });

    // Mock wallet requirement config
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/config/wallet-requirement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requireWallet: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('should show wallet connection section when wallet is required', async () => {
    render(<SimpleLaunchPage />);

    await waitFor(() => {
      // Check for the wallet section heading
      expect(screen.getByText('Connect your wallet to receive 80% of the platform fees')).toBeInTheDocument();
      // Check for the connect wallet button
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });
  });

  it('should disable launch button when wallet is required but not connected', async () => {
    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/moonshot/i);
    const symbolInput = screen.getByPlaceholderText(/moon/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      expect(launchButton).toBeDisabled();
    });
  });

  it('should enable launch button when wallet is connected', async () => {
    // Mock wallet as connected
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      chainId: 8453, // Base mainnet
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnecting: false,
      error: null,
    });

    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/moonshot/i);
    const symbolInput = screen.getByPlaceholderText(/moon/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      expect(launchButton).not.toBeDisabled();
    });
  });

  it('should trigger wallet connection when connect button is clicked', async () => {
    const mockConnect = jest.fn();
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      chainId: null,
      connect: mockConnect,
      disconnect: jest.fn(),
      isConnecting: false,
      error: null,
    });

    render(<SimpleLaunchPage />);

    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      fireEvent.click(connectButton);
    });

    expect(mockConnect).toHaveBeenCalled();
  });

  it('should not require wallet when config says false', async () => {
    // Mock wallet requirement as false
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/config/wallet-requirement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requireWallet: false }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/moonshot/i);
    const symbolInput = screen.getByPlaceholderText(/moon/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      expect(launchButton).not.toBeDisabled();
    });

    // Should not show wallet connection section
    expect(screen.queryByText(/connect.*wallet/i)).not.toBeInTheDocument();
  });

  it('should include wallet address in deployment request when connected', async () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    
    // Mock wallet as connected
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: walletAddress as `0x${string}`,
      chainId: 8453,
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnecting: false,
      error: null,
    });

    // Mock successful deployment
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/deploy/simple')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            tokenAddress: '0xabcd',
            transactionHash: '0x1234',
          }),
        });
      }
      if (url.includes('/api/config/wallet-requirement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requireWallet: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/moonshot/i);
    const symbolInput = screen.getByPlaceholderText(/moon/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    // Submit form
    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
    });

    // Check that deployment was called with wallet address
    await waitFor(() => {
      const deployCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/api/deploy/simple')
      );
      expect(deployCall).toBeDefined();
      
      const requestBody = JSON.parse(deployCall[1].body);
      expect(requestBody.walletAddress).toBe(walletAddress);
    });
  });
});