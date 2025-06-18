import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

jest.mock('@farcaster/frame-sdk', () => ({
  default: {
    actions: {
      openUrl: jest.fn(),
    },
  },
}));

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
    (useFarcasterAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
    jest.clearAllMocks();
  });

  it('renders share button', () => {
    render(<FarcasterShare {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /share on farcaster/i })).toBeInTheDocument();
  });

  it('opens composer with correct cast text', async () => {
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    expect(sdk.actions.openUrl).toHaveBeenCalledWith(
      expect.stringContaining('https://warpcast.com/~/compose?text=')
    );
  });

  it('includes custom message in cast', () => {
    const customMessage = 'This is going to the moon!';
    render(<FarcasterShare {...defaultProps} message={customMessage} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    expect(sdk.actions.openUrl).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(customMessage))
    );
  });

  it('disables button when not authenticated', () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    expect(shareButton).toBeDisabled();
  });

  it('shows tooltip when not authenticated', async () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });
    
    render(<FarcasterShare {...defaultProps} />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.mouseEnter(shareButton);

    await waitFor(() => {
      expect(screen.getByText(/sign in to share/i)).toBeInTheDocument();
    });
  });

  it('handles share error gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (sdk.actions.openUrl as jest.Mock).mockRejectedValueOnce(new Error('Failed to open URL'));

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
    (sdk.actions.openUrl as jest.Mock).mockImplementationOnce(() => 
      new Promise((resolve) => { resolveShare = resolve; })
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

  it('handles channel parameter', () => {
    render(<FarcasterShare {...defaultProps} channel="clanker" />);
    
    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    expect(sdk.actions.openUrl).toHaveBeenCalledWith(
      expect.stringContaining('channelKey=clanker')
    );
  });
});