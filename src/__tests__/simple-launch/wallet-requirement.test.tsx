import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SimpleLaunchPage from '@/app/simple-launch/page';
import { Toaster } from 'sonner';

// Mock fetch
global.fetch = jest.fn();

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock the auth hook
jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn(() => ({
    user: { fid: '123', username: 'testuser' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    clearError: jest.fn(),
    getQuickAuthToken: jest.fn(),
    castContext: null,
  })),
}));

// Mock wallet provider
jest.mock('@/providers/WalletProvider', () => ({
  useWallet: jest.fn(() => ({
    isConnected: false,
    address: null,
    balance: null,
    chainId: null,
    isLoading: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Mock haptic provider
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(() => ({
    buttonPress: jest.fn(() => Promise.resolve()),
    success: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
    warning: jest.fn(() => Promise.resolve()),
    isEnabled: jest.fn(() => true),
  })),
  HapticProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useWalletBalance hook
jest.mock('@/hooks/useWalletBalance', () => ({
  useWalletBalance: () => ({
    balance: null,
    isLoading: false,
    error: null,
  }),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  })),
  usePathname: jest.fn(() => '/simple-launch'),
}));

// Mock react-hook-form
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    register: jest.fn(),
    handleSubmit: (callback: (data: { name: string; symbol: string }) => void) => (e: React.FormEvent) => {
      e?.preventDefault?.();
      callback({ name: 'Test Token', symbol: 'TEST' });
    },
    formState: { errors: {}, isSubmitting: false },
    watch: jest.fn((field) => {
      if (field === 'symbol') return 'TEST';
      if (field === 'name') return 'Test Token';
      return { name: 'Test Token', symbol: 'TEST' };
    }),
    setValue: jest.fn(),
    reset: jest.fn(),
    trigger: jest.fn(),
  }),
}));

import { useWallet } from '@/providers/WalletProvider';
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

describe('SimpleLaunchPage - Wallet Requirement', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Default mock for config API
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/config/wallet-requirement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requireWallet: true })
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = async () => {
    const result = render(
      <>
        <SimpleLaunchPage />
        <Toaster />
      </>
    );
    
    // Wait for initial async operations to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });
    
    return result;
  };

  it('should show wallet requirement message when wallet is required', async () => {
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

    await renderComponent();

    await waitFor(() => {
      expect(screen.getByText('*Wallet required')).toBeInTheDocument();
    });
  });

  it('should disable launch button when wallet is not connected', async () => {
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

    await renderComponent();

    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      expect(launchButton).toBeDisabled();
    });
  });

  it('should show wallet connection prompt instead of optional wallet UI', async () => {
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

    await renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Connect wallet to continue')).toBeInTheDocument();
      expect(screen.queryByText(/optional/i)).not.toBeInTheDocument();
    });
  });

  it('should automatically enable creator rewards when wallet is required', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: null,
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      networkName: 'Base',
    });

    await renderComponent();

    await waitFor(() => {
      const creatorRewardsCheckbox = screen.getByRole('checkbox', { 
        name: /use this wallet for creator rewards/i 
      });
      // Checkbox should be checked and disabled when wallet is required
      expect(creatorRewardsCheckbox).toBeChecked();
      expect(creatorRewardsCheckbox).toBeDisabled();
    });
  });

  it('should update UI when wallet is connected after initial render', async () => {
    // Initially not connected
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

    const { rerender } = await renderComponent();

    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      expect(launchButton).toBeDisabled();
    });

    // Update to connected state
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: null,
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      networkName: 'Base',
    });

    rerender(
      <>
        <SimpleLaunchPage />
        <Toaster />
      </>
    );

    await waitFor(() => {
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      expect(launchButton).toBeEnabled();
    });
  });

  it('should handle wallet connection callback', async () => {
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

    await renderComponent();

    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      expect(connectButton).toBeInTheDocument();
    });

    const connectButton = screen.getByRole('button', { name: /connect wallet/i });
    await userEvent.click(connectButton);

    expect(mockConnect).toHaveBeenCalled();
  });

  it('should handle config API error gracefully', async () => {
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/config/wallet-requirement')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: null,
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      networkName: 'Base',
    });

    await renderComponent();

    // Should fall back to not requiring wallet on error
    await waitFor(() => {
      expect(screen.queryByText(/wallet connection required/i)).not.toBeInTheDocument();
    });
  });
});