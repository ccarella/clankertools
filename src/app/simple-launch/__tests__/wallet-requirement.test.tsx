import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import SimpleLaunchPage from '../page';
import { useWallet } from '@/providers/WalletProvider';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

// Mock the dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/providers/WalletProvider', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn(),
}));

jest.mock('@/components/wallet/WalletButton', () => ({
  WalletButton: ({ onConnect }: { onConnect?: () => void }) => (
    <button onClick={onConnect}>Connect Wallet</button>
  ),
}));

jest.mock('@/providers/HapticProvider');

// Mock fetch
global.fetch = jest.fn();

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock Response for tests
if (typeof Response === 'undefined') {
  global.Response = class Response {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(private body: any, private init?: ResponseInit) {}
    
    async json() {
      return JSON.parse(this.body);
    }
    
    get ok() {
      return !this.init || (this.init.status && this.init.status >= 200 && this.init.status < 300);
    }
    
    get status() {
      return this.init?.status || 200;
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('SimpleLaunchPage - Wallet Requirement Feature', () => {
  jest.setTimeout(10000); // Increase timeout for async operations
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe('When wallet requirement is disabled', () => {
    beforeEach(() => {
      // Mock wallet requirement check to return false
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/config/wallet-requirement') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ requireWallet: false }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });
    });

    it('should allow form submission without wallet connection', async () => {
      (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Fill in form fields
      const nameInput = screen.getByPlaceholderText('My Token');
      const symbolInput = screen.getByPlaceholderText('MYT');
      
      await userEvent.type(nameInput, 'Test Token');
      await userEvent.type(symbolInput, 'TEST');
      
      // Mock file upload
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          writable: false,
          configurable: true
        });
        fireEvent.change(fileInput);
      }

      // Submit form
      const launchButton = screen.getByText('Launch Token');
      fireEvent.click(launchButton);

      // Should go to review step
      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });
    });

    it('should not show wallet requirement message', async () => {
      (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Wait for component to load and fetch config
      await waitFor(() => {
        expect(screen.queryByText(/wallet required/i)).not.toBeInTheDocument();
      });
      
      expect(screen.queryByText(/connect your wallet to receive creator rewards/i)).not.toBeInTheDocument();
    });
  });

  describe('When wallet requirement is enabled', () => {
    beforeEach(() => {
      // Mock wallet requirement check
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/config/wallet-requirement') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ requireWallet: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });
    });

    it('should show wallet requirement message when user is not connected', async () => {
      (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Wait for wallet requirement check
      await waitFor(() => {
        expect(screen.getByText(/wallet required/i)).toBeInTheDocument();
        expect(screen.getByText(/connect your wallet to receive creator rewards/i)).toBeInTheDocument();
      });
    });

    it('should disable launch button when wallet is not connected', async () => {
      (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Fill in form fields
      const nameInput = screen.getByPlaceholderText('My Token');
      const symbolInput = screen.getByPlaceholderText('MYT');
      
      await userEvent.type(nameInput, 'Test Token');
      await userEvent.type(symbolInput, 'TEST');
      
      // Mock file upload
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          writable: false,
          configurable: true
        });
        fireEvent.change(fileInput);
      }

      // Wait for wallet requirement check
      await waitFor(() => {
        const launchButton = screen.getByText('Launch Token');
        expect(launchButton).toBeDisabled();
      });
    });

    it('should show wallet connection prompt when trying to submit without wallet', async () => {
      (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Fill in form fields
      const nameInput = screen.getByPlaceholderText('My Token');
      const symbolInput = screen.getByPlaceholderText('MYT');
      
      await userEvent.type(nameInput, 'Test Token');
      await userEvent.type(symbolInput, 'TEST');
      
      // Mock file upload
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          writable: false,
          configurable: true
        });
        fireEvent.change(fileInput);
      }

      // Wait for wallet requirement check
      await waitFor(() => {
        expect(screen.getByText(/connect wallet to continue/i)).toBeInTheDocument();
      });
    });

    it('should allow form submission when wallet is connected', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      (useWallet as jest.Mock).mockReturnValue({ 
        isConnected: true, 
        address: walletAddress 
      });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Fill in form fields
      const nameInput = screen.getByPlaceholderText('My Token');
      const symbolInput = screen.getByPlaceholderText('MYT');
      
      await userEvent.type(nameInput, 'Test Token');
      await userEvent.type(symbolInput, 'TEST');
      
      // Mock file upload
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', {
          value: [file],
          writable: false,
          configurable: true
        });
        fireEvent.change(fileInput);
      }

      // Wait for wallet requirement check to complete
      await waitFor(() => {
        const launchButton = screen.getByText('Launch Token');
        expect(launchButton).not.toBeDisabled();
      });

      // Submit form
      const launchButton = screen.getByText('Launch Token');
      fireEvent.click(launchButton);

      // Should go to review step
      await waitFor(() => {
        expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      });
    });

    it('should automatically enable creator rewards when wallet is required', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      (useWallet as jest.Mock).mockReturnValue({ 
        isConnected: true, 
        address: walletAddress 
      });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Wait for wallet requirement check
      await waitFor(() => {
        // Creator rewards checkbox should be checked and disabled
        const checkbox = screen.getByRole('checkbox', { name: /use this wallet for creator rewards/i });
        expect(checkbox).toBeChecked();
        expect(checkbox).toBeDisabled();
      });
    });

    it('should update UI when wallet is connected after initial render', async () => {
      const mockUseWallet = useWallet as jest.Mock;
      
      // Start with wallet not connected
      mockUseWallet.mockReturnValue({ 
        isConnected: false, 
        address: null 
      });
      
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      const { rerender } = render(<SimpleLaunchPage />);

      // Check initial state
      await waitFor(() => {
        expect(screen.getByText(/wallet required/i)).toBeInTheDocument();
        expect(screen.getByText('Launch Token')).toBeDisabled();
      });

      // Simulate wallet connection
      const walletAddress = '0x1234567890123456789012345678901234567890';
      mockUseWallet.mockReturnValue({ 
        isConnected: true, 
        address: walletAddress 
      });

      rerender(<SimpleLaunchPage />);

      // Check updated state
      await waitFor(() => {
        expect(screen.queryByText(/wallet required/i)).not.toBeInTheDocument();
        expect(screen.getByText('Connected: 0x1234...7890')).toBeInTheDocument();
        expect(screen.getByText('Launch Token')).not.toBeDisabled();
      });
    });

    it('should handle wallet connection callback', async () => {
      (useWallet as jest.Mock).mockReturnValue({ 
        isConnected: false, 
        address: null 
      });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Wait for wallet requirement check
      await waitFor(() => {
        expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      });

      // Click connect wallet button
      const connectButton = screen.getByText('Connect Wallet');
      fireEvent.click(connectButton);

      // Verify wallet connection was initiated
      // (actual wallet connection would be handled by WalletButton component)
    });
  });

  describe('Wallet requirement configuration error handling', () => {
    it('should default to not required when config API fails', async () => {
      // Mock config API failure
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/config/wallet-requirement') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Server error' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Should not show wallet requirement
      await waitFor(() => {
        expect(screen.queryByText(/wallet required/i)).not.toBeInTheDocument();
      });

      // Fill in form to test submission
      const nameInput = screen.getByPlaceholderText('My Token');
      await userEvent.type(nameInput, 'Test Token');

      // Launch button should be enabled
      const launchButton = screen.getByText('Launch Token');
      expect(launchButton).not.toBeDisabled();
    });

    it('should handle config API network error gracefully', async () => {
      // Mock network error
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/config/wallet-requirement') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
      (useFarcasterAuth as jest.Mock).mockReturnValue({ 
        user: { fid: '12345', username: 'testuser' },
        castContext: null
      });

      render(<SimpleLaunchPage />);

      // Should not show wallet requirement
      await waitFor(() => {
        expect(screen.queryByText(/wallet required/i)).not.toBeInTheDocument();
      });
    });
  });
});