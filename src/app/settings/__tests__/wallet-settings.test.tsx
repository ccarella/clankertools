import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WalletSettings } from '../wallet-settings';
import { useWallet } from '@/providers/WalletProvider';
import { useFarcaster } from '@/components/providers/FarcasterProvider';

jest.mock('@/providers/WalletProvider', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@/components/providers/FarcasterProvider', () => ({
  useFarcaster: jest.fn(),
}));
jest.mock('lucide-react', () => ({
  Wallet: () => <div>Wallet Icon</div>,
  Copy: () => <div>Copy Icon</div>,
  CheckCircle: () => <div>CheckCircle Icon</div>,
  AlertCircle: () => <div>AlertCircle Icon</div>,
  Loader2: () => <div>Loader2 Icon</div>,
  ExternalLink: () => <div>ExternalLink Icon</div>,
}));

const mockUseWallet = jest.mocked(useWallet);
const mockUseFarcaster = jest.mocked(useFarcaster);

describe('WalletSettings', () => {
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFarcaster.mockReturnValue({
      user: { fid: 12345, username: 'testuser' },
      isAuthenticated: true,
    } as ReturnType<typeof useFarcaster>);
  });

  it('renders wallet section with connect button when not connected', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      isLoading: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: null,
      networkName: null,
    });

    render(<WalletSettings />);

    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('Connect your wallet to enable creator rewards')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
  });

  it('renders wallet details when connected', () => {
    mockUseWallet.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      isLoading: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: '1.23',
      networkName: 'Base',
    });

    render(<WalletSettings />);

    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
    expect(screen.getByText('1.23 ETH')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('FID: 12345')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('shows loading state when connecting', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      isLoading: true,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: null,
      networkName: null,
    });

    render(<WalletSettings />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /connecting/i });
    expect(button).toBeDisabled();
  });

  it('handles connect wallet click', async () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      isLoading: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: null,
      networkName: null,
    });

    render(<WalletSettings />);

    const connectButton = screen.getByText('Connect Wallet');
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  it('handles disconnect wallet click', async () => {
    mockUseWallet.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      isLoading: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: '1.23',
      networkName: 'Base',
    });

    render(<WalletSettings />);

    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  it('copies wallet address to clipboard', async () => {
    const mockWriteText = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    mockUseWallet.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      isLoading: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: '1.23',
      networkName: 'Base',
    });

    render(<WalletSettings />);

    const copyButton = screen.getByRole('button', { name: /copy address/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });
  });

  it('shows error state when wallet connection fails', () => {
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      isLoading: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: null,
      networkName: null,
      error: 'Connection failed',
    } as ReturnType<typeof useWallet> & { error: string });

    render(<WalletSettings />);

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('opens wallet address in block explorer', () => {
    const mockOpen = jest.fn();
    window.open = mockOpen;

    mockUseWallet.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      isLoading: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
      balance: '1.23',
      networkName: 'Base',
    });

    render(<WalletSettings />);

    const viewButton = screen.getByRole('button', { name: /view on explorer/i });
    fireEvent.click(viewButton);

    expect(mockOpen).toHaveBeenCalledWith(
      'https://basescan.org/address/0x1234567890123456789012345678901234567890',
      '_blank'
    );
  });
});