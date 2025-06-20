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
      return Promise.reject(new Error('Unhandled fetch'));
    });
  });

  it('should pass chainId from prepare endpoint to ClientDeployment', async () => {
    render(<SimpleLaunchPage />);
    
    // Fill in the form
    const nameInput = screen.getByPlaceholderText('My Token');
    const symbolInput = screen.getByPlaceholderText('MYT');
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });
    
    // Mock file upload
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(submitButton);
    
    // Should show review screen
    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
    });
    
    // Mock prepare endpoint response with chainId
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
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
      } as Response)
    );
    
    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);
    
    // Wait for deployment UI to show
    await waitFor(() => {
      expect(screen.getByText(/deploy your token/i)).toBeInTheDocument();
    });
    
    // Verify that ClientDeployment is rendered with correct props
    // Since we can't directly check props, we can check for the button text
    // which should show "Switch Network & Deploy Token" since wallet is on wrong network
    const deployButton = screen.getByRole('button', { name: /switch network & deploy token/i });
    expect(deployButton).toBeInTheDocument();
  });

  it('should handle network configuration from server response', async () => {
    render(<SimpleLaunchPage />);
    
    // Fill form and get to deployment
    const nameInput = screen.getByPlaceholderText('My Token');
    const symbolInput = screen.getByPlaceholderText('MYT');
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });
    
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    const submitButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Review Your Token')).toBeInTheDocument();
    });
    
    // Mock prepare endpoint with testnet configuration
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
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
          chainId: 84532, // Base Sepolia
          networkName: 'Base Sepolia',
        }),
      } as Response)
    );
    
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(screen.getByText(/deploy your token/i)).toBeInTheDocument();
    });
    
    // Should show "Deploy Token" since wallet is on correct network (84532)
    const deployButton = screen.getByRole('button', { name: /^deploy token$/i });
    expect(deployButton).toBeInTheDocument();
  });
});