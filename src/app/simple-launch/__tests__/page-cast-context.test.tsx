import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SimpleLaunchPage from '../page';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { CastContext } from '@/lib/types/cast-context';

jest.mock('@/components/providers/FarcasterAuthProvider');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock('@/providers/WalletProvider', () => ({
  useWallet: () => ({
    isConnected: false,
    address: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/providers/HapticProvider', () => ({
  HapticProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useHaptic: () => ({
    impactOccurred: jest.fn(),
    notificationOccurred: jest.fn(),
    selectionChanged: jest.fn(),
  }),
}));

global.fetch = jest.fn();

const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;

describe('Simple Launch Page - Cast Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ contractAddress: '0xabc123', transactionHash: '0xtxhash' }),
    });
  });

  it.skip('should include cast context in deployment request', async () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      parentCastId: '0x0987654321fedcba',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User'
      }
    };

    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.png',
      },
      castContext,
      signIn: jest.fn(),
      signOut: jest.fn(),
      isLoading: false,
      error: null,
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn(),
    });

    render(<SimpleLaunchPage />);

    // Fill in form
    fireEvent.change(screen.getByPlaceholderText('My Token'), {
      target: { value: 'Test Token' },
    });
    fireEvent.change(screen.getByPlaceholderText('MYT'), {
      target: { value: 'TEST' },
    });

    // Upload image
    const file = new File(['test-image'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload token image/i);
    fireEvent.change(input, { target: { files: [file] } });

    // Submit form
    await waitFor(() => {
      const deployButton = screen.getByText(/deploy token/i);
      expect(deployButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText(/deploy token/i));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/deploy/simple',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    // Check that FormData includes cast context
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const formData = fetchCall[1].body as FormData;
    const castContextData = formData.get('castContext');
    expect(castContextData).toBe(JSON.stringify(castContext));
  });

  it('should display cast context information before deployment', () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User'
      }
    };

    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
      },
      castContext,
      signIn: jest.fn(),
      signOut: jest.fn(),
      isLoading: false,
      error: null,
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn(),
    });

    render(<SimpleLaunchPage />);

    expect(screen.getByText('Launched from cast')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('should not display cast context when not available', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
      },
      castContext: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      isLoading: false,
      error: null,
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn(),
    });

    render(<SimpleLaunchPage />);

    expect(screen.queryByText('Launched from cast')).not.toBeInTheDocument();
  });

  it.skip('should handle deployment without cast context', async () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
      },
      castContext: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      isLoading: false,
      error: null,
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn(),
    });

    render(<SimpleLaunchPage />);

    // Fill in form
    fireEvent.change(screen.getByPlaceholderText('My Token'), {
      target: { value: 'Test Token' },
    });
    fireEvent.change(screen.getByPlaceholderText('MYT'), {
      target: { value: 'TEST' },
    });

    // Upload image
    const file = new File(['test-image'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload token image/i);
    fireEvent.change(input, { target: { files: [file] } });

    // Submit form
    await waitFor(() => {
      const deployButton = screen.getByText(/deploy token/i);
      expect(deployButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText(/deploy token/i));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Check that FormData does not include cast context
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const formData = fetchCall[1].body as FormData;
    expect(formData.get('castContext')).toBeNull();
  });
});