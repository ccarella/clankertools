import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  WalletButton: () => <button>Connect Wallet</button>,
}));

jest.mock('@/providers/HapticProvider');

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

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('SimpleLaunchPage - Wallet Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (fetch as jest.Mock).mockImplementation((url) => {
      if (url === '/api/config/wallet-requirement') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ requireWallet: false }),
        });
      }
      if (url === '/api/connectWallet') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      if (url === '/api/deploy/simple/prepare') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            deploymentData: {
              name: 'Test Token',
              symbol: 'TEST',
              imageUrl: 'https://example.com/image.png',
              marketCap: '0.1',
              creatorReward: 80,
              deployerAddress: '0x1234567890123456789012345678901234567890',
            },
            chainId: 84532,
            networkName: 'Base Sepolia',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  });

  it('should not show wallet connection section when user is not authenticated', () => {
    (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
    (useFarcasterAuth as jest.Mock).mockReturnValue({ user: null, castContext: null });

    render(<SimpleLaunchPage />);

    expect(screen.queryByText('Creator Rewards Wallet')).not.toBeInTheDocument();
  });

  it('should show wallet connection section when user is authenticated', () => {
    (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
    (useFarcasterAuth as jest.Mock).mockReturnValue({ 
      user: { fid: '12345', username: 'testuser' },
      castContext: null
    });

    render(<SimpleLaunchPage />);

    expect(screen.getByText('Creator Rewards Wallet')).toBeInTheDocument();
    expect(screen.getByText('Connect your wallet to receive 80% of the platform fees')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('should show connected wallet info when wallet is connected', () => {
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

    expect(screen.getByText('Connected: 0x1234...7890')).toBeInTheDocument();
    expect(screen.getByText('Use this wallet for creator rewards')).toBeInTheDocument();
  });

  it('should toggle creator rewards checkbox', () => {
    (useWallet as jest.Mock).mockReturnValue({ 
      isConnected: true, 
      address: '0x1234567890123456789012345678901234567890' 
    });
    (useFarcasterAuth as jest.Mock).mockReturnValue({ 
      user: { fid: '12345', username: 'testuser' },
      castContext: null
    });

    render(<SimpleLaunchPage />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('should store wallet connection data on deployment', async () => {
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

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /launch token/i })).toBeInTheDocument();
    });

    // Submit form to go to review (form data is mocked)
    const launchButton = screen.getByRole('button', { name: /launch token/i });
    fireEvent.click(launchButton);

    // Wait for review state
    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
    });

    // Confirm and launch
    const confirmButton = screen.getByText('Confirm & Launch');
    fireEvent.click(confirmButton);

    // Wait for API calls to be made
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3); // wallet-requirement, connectWallet and deploy
    });

    // Verify wallet connection API was called
    expect(fetch).toHaveBeenCalledWith('/api/connectWallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fid: '12345',
        walletAddress,
        enableCreatorRewards: true,
      }),
    });

    // Verify deployment prepare API was called
    expect(fetch).toHaveBeenCalledWith('/api/deploy/simple/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"userFid":"12345"'),
    });
  });

  it('should show creator wallet in review when connected with rewards enabled', async () => {
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

    // Fill in form and go to review
    fireEvent.change(screen.getByPlaceholderText('My Token'), { target: { value: 'Test Token' } });
    fireEvent.change(screen.getByPlaceholderText('MYT'), { target: { value: 'TEST' } });
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByText('Launch Token'));

    await waitFor(() => {
      expect(screen.getByText('Creator Wallet')).toBeInTheDocument();
      expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
    });
  });

  it('should not show creator wallet in review when rewards are disabled', async () => {
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

    // Disable creator rewards
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Fill in form and go to review
    fireEvent.change(screen.getByPlaceholderText('My Token'), { target: { value: 'Test Token' } });
    fireEvent.change(screen.getByPlaceholderText('MYT'), { target: { value: 'TEST' } });
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByText('Launch Token'));

    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
      expect(screen.queryByText('Creator Wallet')).not.toBeInTheDocument();
    });
  });
});