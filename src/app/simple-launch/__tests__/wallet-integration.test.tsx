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
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('should not show wallet connection section when user is not authenticated', () => {
    (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
    (useFarcasterAuth as jest.Mock).mockReturnValue({ user: null });

    render(<SimpleLaunchPage />);

    expect(screen.queryByText('Creator Rewards Wallet')).not.toBeInTheDocument();
  });

  it('should show wallet connection section when user is authenticated', () => {
    (useWallet as jest.Mock).mockReturnValue({ isConnected: false, address: null });
    (useFarcasterAuth as jest.Mock).mockReturnValue({ 
      user: { fid: '12345', username: 'testuser' } 
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
      user: { fid: '12345', username: 'testuser' } 
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
      user: { fid: '12345', username: 'testuser' } 
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
      user: { fid: '12345', username: 'testuser' } 
    });

    render(<SimpleLaunchPage />);

    // Fill in form fields
    const nameInput = screen.getByPlaceholderText('My Token');
    const symbolInput = screen.getByPlaceholderText('MYT');
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });
    
    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);

    // Submit form to go to review
    const launchButton = screen.getByText('Launch Token');
    fireEvent.click(launchButton);

    // Wait for review state
    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
    });

    // Mock deployment API response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        tokenAddress: '0xtoken123',
      }),
    });

    // Confirm and launch
    const confirmButton = screen.getByText('Confirm & Launch');
    fireEvent.click(confirmButton);

    // Wait for API calls to be made
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2); // connectWallet and deploy
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

    // Verify deployment API was called with fid
    expect(fetch).toHaveBeenCalledWith('/api/deploy/simple', {
      method: 'POST',
      body: expect.any(FormData),
    });

    const deploymentCall = (fetch as jest.Mock).mock.calls.find(
      call => call[0] === '/api/deploy/simple'
    );
    const formData = deploymentCall[1].body as FormData;
    expect(formData.get('fid')).toBe('12345');
  });

  it('should show creator wallet in review when connected with rewards enabled', async () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    (useWallet as jest.Mock).mockReturnValue({ 
      isConnected: true, 
      address: walletAddress 
    });
    (useFarcasterAuth as jest.Mock).mockReturnValue({ 
      user: { fid: '12345', username: 'testuser' } 
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
      user: { fid: '12345', username: 'testuser' } 
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