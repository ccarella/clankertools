import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useParams, useRouter } from 'next/navigation';
import { useFarcasterContext, useOpenComposer } from '@farcaster/frame-sdk';
import TokenSuccessPage from '../page';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@farcaster/frame-sdk', () => ({
  useFarcasterContext: jest.fn(),
  useOpenComposer: jest.fn(),
}));

jest.mock('@/lib/ipfs', () => ({
  getIpfsUrl: jest.fn((url) => url?.replace('ipfs://', 'https://ipfs.io/ipfs/')),
}));

jest.mock('@/lib/transaction-tracker', () => ({
  transactionTracker: {
    getTransaction: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn().mockImplementation((url: string) => {
  // Mock successful token data response
  if (url.includes('/api/token/')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ 
        success: true, 
        data: {
          name: 'Test Token',
          symbol: 'TEST',
          address: '0x1234567890abcdef',
          txHash: '0xabcdef1234567890',
          imageUrl: 'ipfs://test-image',
          creatorAddress: '0xcreator',
          totalSupply: '1000000000',
          marketCap: '50000',
          holders: 42,
          volume24h: '10000',
          priceChange24h: 15.5,
        }
      }),
    });
  }
  return Promise.reject(new Error('Unknown URL'));
});

describe('TokenSuccessPage', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  const mockOpenComposer = jest.fn();
  const mockTokenData = {
    name: 'Test Token',
    symbol: 'TEST',
    address: '0x1234567890abcdef',
    txHash: '0xabcdef1234567890',
    imageUrl: 'ipfs://test-image',
    creatorAddress: '0xcreator',
    totalSupply: '1000000000',
    marketCap: '50000',
    holders: 42,
    volume24h: '10000',
    priceChange24h: 15.5,
  };

  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ address: '0x1234567890abcdef' });
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useFarcasterContext as jest.Mock).mockReturnValue({ isAuthenticated: true });
    (useOpenComposer as jest.Mock).mockReturnValue({ openComposer: mockOpenComposer });
    
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<TokenSuccessPage />);
    
    expect(screen.getByText(/loading token details/i)).toBeInTheDocument();
  });

  it('fetches and displays token data', async () => {
    // fetch mock is already set up in global mock

    render(<TokenSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText(mockTokenData.name)).toBeInTheDocument();
      expect(screen.getByText(`$${mockTokenData.symbol}`)).toBeInTheDocument();
      expect(screen.getByText(/deployed successfully/i)).toBeInTheDocument();
    });
  });

  it('displays token metrics', async () => {
    // fetch mock is already set up in global mock

    render(<TokenSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText(/market cap/i)).toBeInTheDocument();
      expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
      expect(screen.getByText(/holders/i)).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText(/24h volume/i)).toBeInTheDocument();
      expect(screen.getByText(/\$10,000/)).toBeInTheDocument();
    });
  });

  it('shows celebratory animation on mount', async () => {
    // fetch mock is already set up in global mock

    render(<TokenSuccessPage />);

    await waitFor(() => {
      const celebrationElement = screen.getByTestId('celebration-animation');
      expect(celebrationElement).toBeInTheDocument();
      expect(celebrationElement).toHaveClass('animate-in');
    });
  });

  it('handles share to Farcaster button', async () => {
    // fetch mock is already set up in global mock

    render(<TokenSuccessPage />);

    await waitFor(() => {
      const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
      expect(shareButton).toBeInTheDocument();
    });

    const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
    fireEvent.click(shareButton);

    expect(mockOpenComposer).toHaveBeenCalledWith({
      text: expect.stringContaining('Test Token'),
      embeds: expect.arrayContaining([
        expect.stringContaining('/api/frame/token/0x1234567890abcdef')
      ]),
    });
  });

  it('disables share button when not authenticated', async () => {
    (useFarcasterContext as jest.Mock).mockReturnValue({ isAuthenticated: false });
    // fetch mock is already set up in global mock

    render(<TokenSuccessPage />);

    await waitFor(() => {
      const shareButton = screen.getByRole('button', { name: /share on farcaster/i });
      expect(shareButton).toBeDisabled();
    });
  });

  it('shows view on DEX button with correct link', async () => {
    // fetch mock is already set up in global mock

    render(<TokenSuccessPage />);

    await waitFor(() => {
      const dexLink = screen.getByRole('link', { name: /view on dex/i });
      expect(dexLink).toBeInTheDocument();
      expect(dexLink).toHaveAttribute('href', expect.stringContaining('0x1234567890abcdef'));
      expect(dexLink).toHaveAttribute('target', '_blank');
    });
  });

  it('handles copy token address', async () => {
    // fetch mock is already set up in global mock

    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(true),
      },
    });

    render(<TokenSuccessPage />);

    await waitFor(() => {
      const copyButton = screen.getByRole('button', { name: /copy address/i });
      expect(copyButton).toBeInTheDocument();
    });

    const copyButton = screen.getByRole('button', { name: /copy address/i });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0x1234567890abcdef');
    
    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: 'Token not found' }),
    });

    render(<TokenSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText(/error loading token/i)).toBeInTheDocument();
      expect(screen.getByText(/token not found/i)).toBeInTheDocument();
    });
  });

  it('handles retry on error', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Network error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockTokenData }),
      });

    render(<TokenSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText(/error loading token/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(mockTokenData.name)).toBeInTheDocument();
    });
  });

  it('refreshes token data periodically', async () => {
    jest.useFakeTimers();
    
    const updatedData = { ...mockTokenData, holders: 100, marketCap: '75000' };
    
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockTokenData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: updatedData }),
      });

    render(<TokenSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    // Fast forward 30 seconds
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText(/\$75,000/)).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('is mobile responsive', async () => {
    // Mock fetch to return success
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockTokenData }),
    });

    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<TokenSuccessPage />);

    await waitFor(() => {
      const container = screen.getByTestId('success-container');
      expect(container).toHaveClass('flex-col');
    });
  });
});