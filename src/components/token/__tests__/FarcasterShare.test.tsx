import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

jest.mock('@farcaster/frame-sdk', () => {
  const mockSdk = {
    actions: {
      openUrl: jest.fn(),
      composeCast: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockSdk,
  };
});

jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn(),
}));

import FarcasterShare from '../FarcasterShare';
import sdk from '@farcaster/frame-sdk';

describe('FarcasterShare', () => {
  const defaultProps = {
    tokenName: 'Test Token',
    tokenSymbol: 'TEST',
    tokenAddress: '0x1234567890abcdef',
  };

  beforeEach(() => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, castContext: null });
    jest.clearAllMocks();
    // Ensure sdk is properly mocked
    if (sdk?.actions?.openUrl) {
      (sdk.actions.openUrl as jest.Mock).mockClear();
    }
    if (sdk?.actions?.composeCast) {
      (sdk.actions.composeCast as jest.Mock).mockClear();
    }
  });

  it('renders share button', () => {
    render(<FarcasterShare {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /share on farcaster/i })).toBeInTheDocument();
  });

  it('opens composer with composeCast when available', async () => {
    (sdk.actions.composeCast as jest.Mock).mockResolvedValue({ success: true });
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(sdk.actions.composeCast).toHaveBeenCalledWith({
        text: expect.stringContaining('Just launched Test Token ($TEST)'),
      });
    });
  });

  it('falls back to openUrl when composeCast is not available', async () => {
    // Remove composeCast from mock
    const originalComposeCast = sdk.actions.composeCast;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (sdk.actions as any).composeCast;
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(sdk.actions.openUrl).toHaveBeenCalledWith(
        expect.stringContaining('https://warpcast.com/~/compose?text=')
      );
    });

    // Restore composeCast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sdk.actions as any).composeCast = originalComposeCast;
  });

  it('includes custom message in cast', async () => {
    const customMessage = 'This is going to the moon!';
    (sdk.actions.composeCast as jest.Mock).mockResolvedValue({ success: true });
    
    render(<FarcasterShare {...defaultProps} message={customMessage} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(sdk.actions.composeCast).toHaveBeenCalledWith({
        text: expect.stringContaining(customMessage),
      });
    });
  });

  it('includes channel in composeCast when provided', async () => {
    (sdk.actions.composeCast as jest.Mock).mockResolvedValue({ success: true });
    
    render(<FarcasterShare {...defaultProps} channel="clanker" />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(sdk.actions.composeCast).toHaveBeenCalledWith({
        text: expect.stringContaining('Just launched Test Token ($TEST)'),
        channelKey: 'clanker',
      });
    });
  });

  it('disables button when not authenticated', () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, castContext: null });
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    expect(shareButton).toBeDisabled();
  });

  it('shows tooltip when not authenticated', async () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, castContext: null });
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.mouseEnter(shareButton);

    await waitFor(() => {
      expect(screen.getByText(/sign in to share/i)).toBeInTheDocument();
    });
  });

  it('handles share error gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (sdk.actions.composeCast as jest.Mock).mockRejectedValueOnce(new Error('Failed to compose'));

    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to open Farcaster composer:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('tracks share analytics', async () => {
    const trackEvent = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gtag = trackEvent;
    (sdk.actions.composeCast as jest.Mock).mockResolvedValue({ success: true });

    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith('event', 'share_token', {
        token_address: '0x1234567890abcdef',
        token_symbol: 'TEST',
        platform: 'farcaster',
      });
    });
  });

  it('shows loading state while sharing', async () => {
    let resolveShare: () => void;
    const mockComposeCast = sdk.actions?.composeCast as jest.Mock;
    mockComposeCast?.mockImplementationOnce(() => 
      new Promise<void>((resolve) => { resolveShare = resolve; })
    );

    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    expect(screen.getByTestId('share-loading')).toBeInTheDocument();

    // Resolve the promise
    resolveShare!();

    await waitFor(() => {
      expect(screen.queryByTestId('share-loading')).not.toBeInTheDocument();
    });
  });

  it('supports compact variant', () => {
    render(<FarcasterShare {...defaultProps} variant="compact" />);
    
    const shareButton = screen.getByRole('button');
    expect(shareButton).toHaveClass('btn-sm');
    expect(screen.queryByText(/share on farcaster/i)).not.toBeInTheDocument();
  });

  it('handles user cancellation of composeCast', async () => {
    (sdk.actions.composeCast as jest.Mock).mockResolvedValue(null);
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(sdk.actions.composeCast).toHaveBeenCalled();
    });

    // Should not throw error and button should be enabled again
    expect(shareButton).toBeEnabled();
  });

  it('includes frame URL in cast text when using composeCast', async () => {
    (sdk.actions.composeCast as jest.Mock).mockResolvedValue({ success: true });
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(sdk.actions.composeCast).toHaveBeenCalledWith({
        text: expect.stringContaining(`${window.location.origin}/api/frame/token/${defaultProps.tokenAddress}`),
      });
    });
  });
});