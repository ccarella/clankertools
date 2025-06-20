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
  useHaptic: () => ({ 
    triggerHaptic: jest.fn(),
    isEnabled: jest.fn(() => false),
    buttonPress: jest.fn(),
  }),
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
      balance: null,
      chainId: null,
      isLoading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      networkName: null,
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
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/myt/i);
    
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
      balance: null,
      chainId: 8453, // Base mainnet
      isLoading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      networkName: 'Base',
    });

    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/myt/i);
    
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
      balance: null,
      chainId: null,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: jest.fn(),
      networkName: null,
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
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/myt/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      expect(launchButton).not.toBeDisabled();
    });

    // Should show wallet connection section but not require it
    expect(screen.getByText(/Creator Rewards Wallet/i)).toBeInTheDocument();
    // Should not show "Wallet required" text
    expect(screen.queryByText(/\*Wallet required/i)).not.toBeInTheDocument();
  });

  it('should include wallet address in deployment request when connected', async () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    
    // Mock wallet as connected
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: walletAddress as `0x${string}`,
      balance: null,
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      networkName: 'Base',
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
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/myt/i);
    const fileInput = screen.getByTestId('file-input');
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);

    // Submit form to go to review page
    const launchButton = screen.getByRole('button', { name: /launch token/i });
    fireEvent.click(launchButton);

    // Wait for review page and click Confirm & Launch
    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);

    // Check that deployment was called with wallet address
    await waitFor(() => {
      const deployCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/api/deploy/simple/prepare')
      );
      expect(deployCall).toBeDefined();
      
      const requestBody = JSON.parse(deployCall[1].body);
      expect(requestBody.walletAddress).toBe(walletAddress);
    });
  });
});