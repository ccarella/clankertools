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

// Mock fetch
global.fetch = jest.fn();

// Helper to create test image file
const createMockImageFile = () => {
  const blob = new Blob(['test'], { type: 'image/png' });
  const file = new File([blob], 'test.png', { type: 'image/png' });
  return file;
};

describe('SimpleLaunchPage - Review Page Wallet Connection', () => {
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

    // Mock Farcaster SDK context
    (sdk.context.get as jest.Mock).mockResolvedValue({
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.jpg',
      },
    });

    // Mock config endpoints
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

  describe('Review Page - Wallet Not Connected', () => {
    beforeEach(() => {
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
      });
    });

    it('should show "Connect Wallet" button instead of "Confirm & Launch" when wallet not connected', async () => {
      render(<SimpleLaunchPage />);

      // Fill out form and submit to review
      const nameInput = screen.getByPlaceholderText(/my token/i);
      const symbolInput = screen.getByPlaceholderText(/myt/i);
      const fileInput = screen.getByTestId('file-input');

      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      // Mock file upload
      const file = createMockImageFile();
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(fileInput);

      // Submit form to go to review page
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);

      // Wait for review page
      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });

      // Should show "Connect Wallet" button instead of "Confirm & Launch"
      const connectWalletButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(connectWalletButton).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /confirm & launch/i })).not.toBeInTheDocument();
    });

    it('should trigger wallet connection when "Connect Wallet" button is clicked on review page', async () => {
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
      });

      render(<SimpleLaunchPage />);

      // Navigate to review page
      const nameInput = screen.getByPlaceholderText(/my token/i);
      const symbolInput = screen.getByPlaceholderText(/myt/i);
      const fileInput = screen.getByTestId('file-input');

      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      const file = createMockImageFile();
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(fileInput);

      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });

      // Click Connect Wallet button
      const connectWalletButton = screen.getByRole('button', { name: /connect wallet/i });
      fireEvent.click(connectWalletButton);

      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('Review Page - Wallet Connected', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';

    beforeEach(() => {
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
      });
    });

    it('should show "Confirm & Launch" button when wallet is connected', async () => {
      render(<SimpleLaunchPage />);

      // Navigate to review page
      const nameInput = screen.getByPlaceholderText(/my token/i);
      const symbolInput = screen.getByPlaceholderText(/myt/i);
      const fileInput = screen.getByTestId('file-input');

      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      const file = createMockImageFile();
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(fileInput);

      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });

      // Should show "Confirm & Launch" button
      const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
      expect(confirmButton).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
    });

    it('should display creator wallet address on review page', async () => {
      render(<SimpleLaunchPage />);

      // Navigate to review page
      const nameInput = screen.getByPlaceholderText(/my token/i);
      const symbolInput = screen.getByPlaceholderText(/myt/i);
      const fileInput = screen.getByTestId('file-input');

      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      const file = createMockImageFile();
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(fileInput);

      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });

      // Should display truncated wallet address
      expect(screen.getByText('Creator Wallet')).toBeInTheDocument();
      expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
    });
  });

  describe('Review Page - Dynamic Wallet Connection', () => {
    it('should update button from "Connect Wallet" to "Confirm & Launch" after successful connection', async () => {
      const mockConnect = jest.fn(() => {
        // Re-render with connected state
        mockUseWallet.mockReturnValue({
          isConnected: true,
          address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
          balance: null,
          chainId: 8453,
          isLoading: false,
          error: null,
          connect: mockConnect,
          disconnect: jest.fn(),
        });
      });

      // Start with disconnected wallet
      mockUseWallet.mockReturnValue({
        isConnected: false,
        address: null,
        balance: null,
        chainId: null,
        isLoading: false,
        error: null,
        connect: mockConnect,
        disconnect: jest.fn(),
      });

      const { rerender } = render(<SimpleLaunchPage />);

      // Navigate to review page
      const nameInput = screen.getByPlaceholderText(/my token/i);
      const symbolInput = screen.getByPlaceholderText(/myt/i);
      const fileInput = screen.getByTestId('file-input');

      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      const file = createMockImageFile();
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(fileInput);

      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });

      // Should show Connect Wallet button
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();

      // Click Connect Wallet
      const connectWalletButton = screen.getByRole('button', { name: /connect wallet/i });
      fireEvent.click(connectWalletButton);

      // Re-render to simulate wallet state update
      rerender(<SimpleLaunchPage />);

      // Should now show Confirm & Launch button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm & launch/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Deployment Error Handling', () => {
    it('should not show wallet validation error when wallet is connected', async () => {
      // Mock wallet as connected
      mockUseWallet.mockReturnValue({
        isConnected: true,
        address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        chainId: 8453,
        connect: jest.fn(),
        disconnect: jest.fn(),
        isLoading: false,
        error: null,
      });

      // Mock successful prepare API response
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/deploy/simple/prepare')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              deploymentData: {
                name: 'Test Token',
                symbol: 'TEST',
                imageUrl: 'ipfs://test',
                marketCap: '0.1',
                creatorReward: 80,
                deployerAddress: '0x1234567890123456789012345678901234567890',
              },
              chainId: 8453,
              networkName: 'base',
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

      // Navigate to review page and deploy
      const nameInput = screen.getByPlaceholderText(/my token/i);
      const symbolInput = screen.getByPlaceholderText(/myt/i);
      const fileInput = screen.getByTestId('file-input');

      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      const file = createMockImageFile();
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fireEvent.change(fileInput);

      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);

      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });

      // Click Confirm & Launch
      const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
      fireEvent.click(confirmButton);

      // Should not show wallet validation error
      await waitFor(() => {
        expect(screen.queryByText(/wallet address required/i)).not.toBeInTheDocument();
      });
    });
  });
});