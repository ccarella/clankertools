import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletButton } from '../WalletButton';
import { WalletProvider } from '@/providers/WalletProvider';
import * as walletHooks from '@/providers/WalletProvider';
import * as balanceHooks from '@/hooks/useWalletBalance';

// Mock the useWallet hook
jest.mock('@/providers/WalletProvider', () => ({
  ...jest.requireActual('@/providers/WalletProvider'),
  useWallet: jest.fn(),
}));

jest.mock('@/providers/HapticProvider');

// Mock the useWalletBalance hook
jest.mock('@/hooks/useWalletBalance', () => ({
  useWalletBalance: jest.fn(() => ({
    balance: null,
    isLoading: false,
    error: null,
  })),
}));

const mockUseWallet = walletHooks.useWallet as jest.MockedFunction<typeof walletHooks.useWallet>;
const mockUseWalletBalance = balanceHooks.useWalletBalance as jest.MockedFunction<typeof balanceHooks.useWalletBalance>;

describe('WalletButton', () => {
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset balance mock to default
    mockUseWalletBalance.mockReturnValue({
      balance: null,
      isLoading: false,
      error: null,
    });
  });

  it('should render connect button when not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: null,
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByRole('button')).toHaveTextContent('Connect Wallet');
  });

  it('should show loading state when connecting', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
      isLoading: true,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: null,
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Connecting...');
    expect(button).toBeDisabled();
  });

  it('should display truncated address when connected', () => {
    const fullAddress = '0x1234567890123456789012345678901234567890';
    const expectedTruncated = '0x1234...7890';

    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: fullAddress,
      balance: '1.5',
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: 'Base',
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByText(expectedTruncated)).toBeInTheDocument();
  });

  it('should display balance when connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: '2.5',
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: 'Base',
    });

    // Mock balance for this test
    mockUseWalletBalance.mockReturnValue({
      balance: '2.5',
      isLoading: false,
      error: null,
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByText('2.5 ETH')).toBeInTheDocument();
    expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
  });

  it('should call connect when connect button is clicked', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: null,
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    await userEvent.click(screen.getByRole('button'));

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('should show dropdown menu when connected address is clicked', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: '1.0',
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: 'Base',
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    const button = screen.getByRole('button');
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Copy Address')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });

  it('should copy address when Copy Address is clicked', async () => {
    const address = '0x1234567890123456789012345678901234567890';
    
    // Mock clipboard API
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    mockUseWallet.mockReturnValue({
      isConnected: true,
      address,
      balance: '1.0',
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: 'Base',
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Copy Address')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Copy Address'));

    expect(mockWriteText).toHaveBeenCalledWith(address);
  });

  it('should call disconnect when Disconnect is clicked', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: '1.0',
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: 'Base',
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Disconnect'));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should show network badge when connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: '1.0',
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: 'Base',
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByText('Base')).toBeInTheDocument();
  });

  it('should show wrong network warning for non-Base chains', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: '1.0',
      chainId: 1, // Ethereum mainnet
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: null,
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByText('Wrong Network')).toBeInTheDocument();
  });

  it('should handle zero balance correctly', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      balance: '0',
      chainId: 8453,
      isLoading: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      networkName: 'Base',
    });

    // Mock zero balance
    mockUseWalletBalance.mockReturnValue({
      balance: '0',
      isLoading: false,
      error: null,
    });

    render(
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    );

    expect(screen.getByText('0 ETH')).toBeInTheDocument();
    expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
  });
});