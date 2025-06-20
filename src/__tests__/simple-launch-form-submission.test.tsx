import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import SimpleLaunchPage from '@/app/simple-launch/page';
import { useWallet } from '@/providers/WalletProvider';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/providers/WalletProvider');
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: () => ({
    triggerHaptic: jest.fn(),
    buttonPress: jest.fn(() => Promise.resolve()),
    success: jest.fn(() => Promise.resolve()),
    error: jest.fn(() => Promise.resolve()),
    warning: jest.fn(() => Promise.resolve()),
    isEnabled: jest.fn(() => true),
  }),
}));
jest.mock('@/components/providers/FarcasterAuthProvider');
jest.mock('@/hooks/useWalletBalance', () => ({
  useWalletBalance: () => ({
    balance: null,
    isLoading: false,
    error: null,
  }),
}));
// Mock ClientDeployment to avoid issues with the deployment flow
jest.mock('@/components/deploy/ClientDeployment', () => ({
  ClientDeployment: () => null,
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;

// Mock fetch for config endpoint
global.fetch = jest.fn();

// Mock FileReader
interface MockFileReader {
  readAsDataURL: jest.Mock;
  onloadend: (() => void) | null;
  result: string;
}

interface FileReaderMock extends jest.Mock {
  mockInstance?: MockFileReader;
}

const mockFileReaderInstances: MockFileReader[] = [];
const FileReaderMock = jest.fn().mockImplementation(() => {
  const reader: MockFileReader = {
    readAsDataURL: jest.fn(function(this: MockFileReader) {
      // Simulate async read
      setTimeout(() => {
        if (this.onloadend) {
          this.onloadend();
        }
      }, 0);
    }),
    onloadend: null,
    result: 'data:image/png;base64,mockbase64data',
  };
  mockFileReaderInstances.push(reader);
  // Store the instance for later access
  (FileReaderMock as FileReaderMock).mockInstance = reader;
  return reader;
}) as FileReaderMock;

global.FileReader = FileReaderMock as unknown as typeof FileReader;

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
      networkName: 'Base',
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
      isAuthenticated: true,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn(),
    });

    // Mock wallet requirement config
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/config/wallet-requirement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requireWallet: true }),
        });
      }
      if (url.includes('/api/connectWallet')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
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
    
    // Wait for initial async operations to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });
    });

    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      // Wait a bit for FileReader to be instantiated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger FileReader onloadend
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

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
              marketCap: '1000000',
              creatorReward: 0.8,
              deployerAddress: '0xdeployer',
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
      if (url.includes('/api/connectWallet')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
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
    
    await act(async () => {
      fireEvent.click(launchButton);
    });

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for the confirm button to appear - it might need wallet connection
    const confirmButton = await waitFor(() => {
      // In review screen, if wallet is not connected, it shows "Connect Wallet" button instead
      // Since we have wallet connected in this test, it should show "Confirm & Launch"
      return screen.getByRole('button', { name: /confirm & launch/i });
    }, { timeout: 3000 });
    
    await act(async () => {
      fireEvent.click(confirmButton);
    });

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
      isAuthenticated: false,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn(),
    });

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
              marketCap: '1000000',
              creatorReward: 0.8,
              deployerAddress: '0xdeployer',
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
      if (url.includes('/api/connectWallet')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<SimpleLaunchPage />);
    
    // Wait for initial async operations to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      // Mock file upload
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = screen.getByTestId('file-input');
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      // Wait a bit for FileReader to be instantiated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger FileReader onloadend
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    // Submit form
    const launchButton = await waitFor(() => 
      screen.getByRole('button', { name: /launch token/i })
    );
    
    await act(async () => {
      fireEvent.click(launchButton);
    });

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for the confirm button to appear - it might need wallet connection
    const confirmButton = await waitFor(() => {
      // In review screen, if wallet is not connected, it shows "Connect Wallet" button instead
      // Since we have wallet connected in this test, it should show "Confirm & Launch"
      return screen.getByRole('button', { name: /confirm & launch/i });
    }, { timeout: 3000 });
    
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // Wait for the deployment to be triggered
    await waitFor(() => {
      // The component should show either success or the deployment component
      const deployCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/api/deploy/simple/prepare')
      );
      expect(deployCall).toBeDefined();
      
      const requestBody = JSON.parse(deployCall[1].body);
      expect(requestBody.userFid).toBe(0);
    }, { timeout: 5000 });
  });

  it('should require wallet connection in review screen even when wallet not required', async () => {
    // This test verifies the current behavior where wallet connection is enforced in review screen
    // regardless of the requireWallet config setting
    
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
      networkName: null,
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
    
    // Wait for initial async operations to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });

      // Mock file upload
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = screen.getByTestId('file-input');
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      // Wait a bit for FileReader to be instantiated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger FileReader onloadend
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    // Submit form - this should work since wallet is not required
    const launchButton = await waitFor(() => 
      screen.getByRole('button', { name: /launch token/i })
    );
    expect(launchButton).not.toBeDisabled();
    
    await act(async () => {
      fireEvent.click(launchButton);
    });

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    });

    // In review screen, wallet is not connected, so it shows "Connect Wallet" button
    // instead of "Confirm & Launch", even though wallet is not required
    const connectButton = await waitFor(() => {
      return screen.getByRole('button', { name: /connect wallet/i });
    });
    
    expect(connectButton).toBeInTheDocument();
    // Verify that "Confirm & Launch" is NOT shown
    expect(screen.queryByRole('button', { name: /confirm & launch/i })).not.toBeInTheDocument();
  });

  it('should handle API validation errors properly', async () => {
    // Mock API error response - set up before render
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/deploy/simple/prepare')) {
        return Promise.resolve({
          ok: false,
          status: 400,
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
      if (url.includes('/api/connectWallet')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<SimpleLaunchPage />);
    
    // Wait for initial async operations to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });
    });

    // Mock file upload
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      // Wait a bit for FileReader to be instantiated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger FileReader onloadend
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    // Submit form
    const launchButton = await waitFor(() => 
      screen.getByRole('button', { name: /launch token/i })
    );
    
    await act(async () => {
      fireEvent.click(launchButton);
    });

    // Navigate to review screen
    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for the confirm button to appear - it might need wallet connection
    const confirmButton = await waitFor(() => {
      // In review screen, if wallet is not connected, it shows "Connect Wallet" button instead
      // Since we have wallet connected in this test, it should show "Confirm & Launch"
      return screen.getByRole('button', { name: /confirm & launch/i });
    }, { timeout: 3000 });
    
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // Wait for error state to be displayed
    await waitFor(() => {
      expect(screen.getByText(/deployment failed/i)).toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Check for the user-friendly error message
    await waitFor(() => {
      expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument();
    });
  });
});