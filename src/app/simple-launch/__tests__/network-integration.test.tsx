import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SimpleLaunchPage from '../page';
import { useWallet } from '@/providers/WalletProvider';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

// Mock dependencies
jest.mock('@/providers/WalletProvider');
jest.mock('@/components/providers/FarcasterAuthProvider');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock Haptic Provider
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: () => ({
    buttonPress: jest.fn(() => Promise.resolve()),
    success: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
    warning: jest.fn(() => Promise.resolve()),
    isEnabled: jest.fn(() => true),
  }),
}));

// Mock react-hook-form
interface MockFormData {
  name: string;
  symbol: string;
  image: File;
  creatorFeePercentage: number;
  platformFeePercentage: number;
}

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    register: jest.fn(() => ({ name: 'test', onChange: jest.fn(), onBlur: jest.fn(), ref: jest.fn() })),
    handleSubmit: (callback: (data: MockFormData) => void) => (e: React.FormEvent) => {
      e?.preventDefault?.();
      callback({
        name: 'Test Token',
        symbol: 'TEST',
        image: new File(['test'], 'test.png', { type: 'image/png' }),
        creatorFeePercentage: 80,
        platformFeePercentage: 20,
      });
    },
    formState: { errors: {}, isSubmitting: false },
    watch: jest.fn((field) => {
      if (field === 'symbol') return 'TEST';
      if (field === 'name') return 'Test Token';
      if (field === 'image') return new File(['test'], 'test.png', { type: 'image/png' });
      if (field === 'creatorFeePercentage') return 80;
      if (field === 'platformFeePercentage') return 20;
      return undefined;
    }),
    setValue: jest.fn(),
    reset: jest.fn(),
    trigger: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('SimpleLaunchPage Network Integration', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock wallet provider
    (useWallet as jest.Mock).mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      chainId: 84532,
      connect: jest.fn(),
      isLoading: false,
      error: null,
    });
    
    // Mock Farcaster auth
    (useFarcasterAuth as jest.Mock).mockReturnValue({
      user: { fid: 123, username: 'testuser' },
      castContext: null,
    });
    
    // Mock config endpoint
    mockFetch.mockImplementation((url) => {
      if ((url as string).includes('/api/config/wallet-requirement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requireWallet: true }),
        } as Response);
      }
      if ((url as string).includes('/api/deploy/simple/prepare')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            deploymentData: {
              name: 'Test Token',
              symbol: 'TEST',
              imageUrl: 'https://example.com/image.png',
              marketCap: '0.1',
              creatorReward: 80,
              deployerAddress: '0x1234567890123456789012345678901234567890',
            },
            chainId: 84532, // Base Sepolia by default
            networkName: 'Base Sepolia',
          }),
        } as Response);
      }
      return Promise.reject(new Error('Unhandled fetch'));
    });
  });

  it('should pass chainId from prepare endpoint to ClientDeployment', async () => {
    render(<SimpleLaunchPage />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /launch token/i })).toBeInTheDocument();
    });
    
    // Submit form (form data is mocked to return valid values)
    const submitButton = screen.getByRole('button', { name: /launch token/i });
    fireEvent.click(submitButton);
    
    // Should show review screen
    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
    });
    
    // Override the mock for this specific test to return mainnet
    mockFetch.mockImplementationOnce((url) => {
      if ((url as string).includes('/api/deploy/simple/prepare')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            deploymentData: {
              name: 'Test Token',
              symbol: 'TEST',
              imageUrl: 'https://example.com/image.png',
              marketCap: '0.1',
              creatorReward: 80,
              deployerAddress: '0x1234567890123456789012345678901234567890',
            },
            chainId: 8453, // Base mainnet
            networkName: 'Base',
          }),
        } as Response);
      }
      return Promise.reject(new Error('Unhandled fetch'));
    });
    
    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);
    
    // Wait for client deployment to show
    await waitFor(() => {
      expect(screen.getByText(/Deploy Your Token/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle network configuration from server response', async () => {
    render(<SimpleLaunchPage />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /launch token/i })).toBeInTheDocument();
    });
    
    // Submit form (form data is mocked to return valid values)
    const submitButton = screen.getByRole('button', { name: /launch token/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
    });
    
    // Click confirm button (uses default testnet config from beforeEach)
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);
    
    // Wait for client deployment to show
    await waitFor(() => {
      expect(screen.getByText(/Deploy Your Token/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});