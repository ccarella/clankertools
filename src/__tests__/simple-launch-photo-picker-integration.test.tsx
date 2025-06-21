import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import SimpleLaunchPage from '@/app/simple-launch/page';
import { useWallet } from '@/providers/WalletProvider';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

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
jest.mock('@/components/deploy/ClientDeployment', () => ({
  ClientDeployment: () => null,
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;

global.fetch = jest.fn();

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
  (FileReaderMock as FileReaderMock).mockInstance = reader;
  return reader;
}) as FileReaderMock;

global.FileReader = FileReaderMock as unknown as typeof FileReader;

const mockMediaDevices = {
  getUserMedia: jest.fn()
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices
});

describe('SimpleLaunchPage - PhotoPicker Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileReaderInstances.length = 0;
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as ReturnType<typeof useRouter>);

    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      chainId: 8453,
      connect: jest.fn(),
      disconnect: jest.fn(),
      balance: null,
      isLoading: false,
      error: null,
      networkName: 'Base',
    });

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

    mockMediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [{
        stop: jest.fn()
      }]
    });
  });

  it('should integrate PhotoPicker seamlessly into the form', async () => {
    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
  });

  it('should display take photo button on mobile devices with camera support', async () => {
    mockMediaDevices.getUserMedia.mockResolvedValueOnce({
      getTracks: () => [{
        stop: jest.fn()
      }]
    });

    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
    });
  });

  it('should handle drag and drop image upload', async () => {
    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    const dropzone = screen.getByText(/click to upload or drag and drop/i).closest('.card');
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    
    await act(async () => {
      fireEvent.dragEnter(dropzone!, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      });
    });
    
    await act(async () => {
      fireEvent.drop(dropzone!, {
        dataTransfer: {
          files: [file],
          types: ['Files']
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    await waitFor(() => {
      expect(screen.getByAltText('Token preview')).toBeInTheDocument();
    });
  });

  it('should validate image file size limit', async () => {
    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [largeFile] } });
    });

    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });
    });

    const launchButton = screen.getByRole('button', { name: /launch token/i });
    await act(async () => {
      fireEvent.click(launchButton);
    });

    expect(screen.getByText(/image is required/i)).toBeInTheDocument();
  });

  it('should validate image file type', async () => {
    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    });

    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });
    });

    const launchButton = screen.getByRole('button', { name: /launch token/i });
    await act(async () => {
      fireEvent.click(launchButton);
    });

    expect(screen.getByText(/image is required/i)).toBeInTheDocument();
  });

  it('should show image preview with change button after selection', async () => {
    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    await waitFor(() => {
      expect(screen.getByAltText('Token preview')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
    });
  });

  it('should handle camera permissions gracefully', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /take photo/i })).not.toBeInTheDocument();
    });
  });

  it('should pass image data correctly to the API', async () => {
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
          json: () => Promise.resolve({ requireWallet: false }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<SimpleLaunchPage />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/config/wallet-requirement');
    });

    const nameInput = screen.getByPlaceholderText(/my token/i);
    const symbolInput = screen.getByPlaceholderText(/MYT/i);
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');
    
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test Token' } });
      fireEvent.change(symbolInput, { target: { value: 'TEST' } });
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const reader = (FileReaderMock as FileReaderMock).mockInstance;
      if (reader && reader.onloadend) {
        reader.onloadend();
      }
    });

    const launchButton = screen.getByRole('button', { name: /launch token/i });
    await act(async () => {
      fireEvent.click(launchButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/review your token/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      const deployCall = (global.fetch as jest.Mock).mock.calls.find(
        call => call[0].includes('/api/deploy/simple/prepare')
      );
      expect(deployCall).toBeDefined();
      
      const requestBody = JSON.parse(deployCall[1].body);
      expect(requestBody.imageFile).toBe('data:image/png;base64,mockbase64data');
    });
  });

  it('should maintain mobile-first responsive design', () => {
    render(<SimpleLaunchPage />);
    
    const uploadCard = screen.getByText(/click to upload or drag and drop/i).closest('.card');
    expect(uploadCard).toHaveClass('p-8');
    
    const uploadArea = screen.getByText(/click to upload or drag and drop/i).parentElement;
    expect(uploadArea).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'text-center');
  });
});