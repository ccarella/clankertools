import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import SimpleLaunchPage from '@/app/simple-launch/page';
import { useWallet } from '@/providers/WalletProvider';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/providers/WalletProvider');
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: () => ({ triggerHaptic: jest.fn() }),
}));
jest.mock('@/components/providers/FarcasterAuthProvider');

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;

// Mock fetch for config endpoint
global.fetch = jest.fn();

// Mock FileReader
global.FileReader = jest.fn(() => ({
  readAsDataURL: jest.fn(),
  onloadend: null,
  result: 'data:image/png;base64,mockbase64data',
})) as unknown as typeof FileReader;

describe('SimpleLaunchPage - Form Submission', () => {
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

    // Default wallet state - connected
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      chainId: 8453, // Base mainnet
      connect: jest.fn(),
      disconnect: jest.fn(),
      balance: null,
      isLoading: false,
      error: null,
    });

    // Mock Farcaster auth - authenticated user
    mockUseFarcasterAuth.mockReturnValue({
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.jpg',
      },
      castContext: null,
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

  it('should send correct field names to the API', async () => {
    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Trigger FileReader onloadend
    const reader = (FileReader as jest.Mock).mock.instances[0];
    reader.onloadend();

    // Mock successful API response
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/deploy/simple/prepare')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            deploymentData: {
              name: 'Test Token',
              symbol: 'TEST',
              imageUrl: 'https://example.com/image.png',
            },
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

    // Submit form
    const launchButton = await waitFor(() => 
      screen.getByRole('button', { name: /launch token/i })
    );
    fireEvent.click(launchButton);

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    });

    // Confirm launch
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);

    // Check that the API was called with correct field names
    await waitFor(() => {
      const deployCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/api/deploy/simple/prepare')
      );
      expect(deployCall).toBeDefined();
      
      const requestBody = JSON.parse(deployCall[1].body);
      expect(requestBody).toEqual({
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        imageFile: 'data:image/png;base64,mockbase64data',
        description: '',
        userFid: 123,
        walletAddress: '0x1234567890123456789012345678901234567890',
      });
    });
  });

  it('should handle missing FID when user is not authenticated', async () => {
    // Mock unauthenticated user
    mockUseFarcasterAuth.mockReturnValue({
      user: null,
      castContext: null,
    });

    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Trigger FileReader onloadend
    const reader = (FileReader as jest.Mock).mock.instances[0];
    reader.onloadend();

    // Submit form
    const launchButton = await waitFor(() => 
      screen.getByRole('button', { name: /launch token/i })
    );
    fireEvent.click(launchButton);

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    });

    // Confirm launch
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);

    // Check that the API was called with FID = 0
    await waitFor(() => {
      const deployCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/api/deploy/simple/prepare')
      );
      expect(deployCall).toBeDefined();
      
      const requestBody = JSON.parse(deployCall[1].body);
      expect(requestBody.userFid).toBe(0);
    });
  });

  it('should handle missing wallet address', async () => {
    // Mock disconnected wallet
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      chainId: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      balance: null,
      isLoading: false,
      error: null,
    });

    // Mock wallet not required
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
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Trigger FileReader onloadend
    const reader = (FileReader as jest.Mock).mock.instances[0];
    reader.onloadend();

    // Submit form
    const launchButton = await waitFor(() => 
      screen.getByRole('button', { name: /launch token/i })
    );
    fireEvent.click(launchButton);

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    });

    // Confirm launch
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);

    // Check that the API was called with empty wallet address
    await waitFor(() => {
      const deployCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/api/deploy/simple/prepare')
      );
      expect(deployCall).toBeDefined();
      
      const requestBody = JSON.parse(deployCall[1].body);
      expect(requestBody.walletAddress).toBe('');
    });
  });

  it('should handle API validation errors properly', async () => {
    render(<SimpleLaunchPage />);

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } });
    fireEvent.change(symbolInput, { target: { value: 'TEST' } });

    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Trigger FileReader onloadend
    const reader = (FileReader as jest.Mock).mock.instances[0];
    reader.onloadend();

    // Mock API error response
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/deploy/simple/prepare')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({
            success: false,
            error: 'Missing required fields',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: 'tokenName, tokenSymbol, imageFile, and userFid are required',
              userMessage: 'Please fill in all required fields',
            },
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

    // Submit form
    const launchButton = await waitFor(() => 
      screen.getByRole('button', { name: /launch token/i })
    );
    fireEvent.click(launchButton);

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    });

    // Confirm launch
    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    fireEvent.click(confirmButton);

    // Check that error is displayed
    await waitFor(() => {
      expect(screen.getByText(/deployment failed/i)).toBeInTheDocument();
      expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument();
    });
  });
});