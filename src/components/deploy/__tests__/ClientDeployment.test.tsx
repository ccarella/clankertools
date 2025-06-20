import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientDeployment } from '../ClientDeployment';
import { useWallet } from '@/providers/WalletProvider';
import sdk from '@farcaster/frame-sdk';
import { getClientNetworkConfig } from '@/lib/client-network-config';

jest.mock('@/providers/WalletProvider');
jest.mock('@farcaster/frame-sdk');
jest.mock('clanker-sdk');
jest.mock('@/lib/client-network-config');

const mockTokenData = {
  name: 'Test Token',
  symbol: 'TEST',
  imageUrl: 'https://example.com/image.png',
  description: 'Test description',
  marketCap: '100',
  creatorReward: 50,
  deployerAddress: '0x123',
};

describe('ClientDeployment', () => {
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();
  const mockGetEthereumProvider = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (sdk.wallet.getEthereumProvider as jest.Mock) = mockGetEthereumProvider;
    
    // Mock client network config to return testnet by default
    (getClientNetworkConfig as jest.Mock).mockReturnValue({
      network: 'testnet',
      chainId: 84532,
      chainIdHex: '0x14A34',
      name: 'Base Sepolia',
      rpcUrl: 'https://sepolia.base.org',
      isMainnet: false
    });
  });

  it('should default to testnet (Base Sepolia) when no targetChainId is provided', () => {
    (useWallet as jest.Mock).mockReturnValue({
      isConnected: true,
      address: '0x123',
      chainId: 8453, // Base mainnet
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Switch Network & Deploy Token');
  });

  it('should use mainnet when network config returns mainnet', () => {
    // Mock client network config to return mainnet
    (getClientNetworkConfig as jest.Mock).mockReturnValue({
      network: 'mainnet',
      chainId: 8453,
      chainIdHex: '0x2105',
      name: 'Base',
      rpcUrl: 'https://mainnet.base.org',
      isMainnet: true
    });
    
    (useWallet as jest.Mock).mockReturnValue({
      isConnected: true,
      address: '0x123',
      chainId: 84532, // Base Sepolia
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Switch Network & Deploy Token');
  });

  it('should respect targetChainId prop over network config', () => {
    
    (useWallet as jest.Mock).mockReturnValue({
      isConnected: true,
      address: '0x123',
      chainId: 8453, // Base mainnet
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        targetChainId={8453}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Deploy Token');
  });

  it('should show Deploy Token when on correct network', () => {
    (useWallet as jest.Mock).mockReturnValue({
      isConnected: true,
      address: '0x123',
      chainId: 84532, // Base Sepolia (default)
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Deploy Token');
  });

  it('should attempt to switch network when deploying on wrong network', async () => {
    const mockProvider = {
      request: jest.fn().mockResolvedValue(undefined),
    };
    mockGetEthereumProvider.mockResolvedValue(mockProvider);

    (useWallet as jest.Mock).mockReturnValue({
      isConnected: true,
      address: '0x123',
      chainId: 8453, // Wrong network
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }], // 84532 in hex
      });
    });
  });

  it('should show error when wallet is not connected', () => {
    (useWallet as jest.Mock).mockReturnValue({
      isConnected: false,
      address: null,
      chainId: null,
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    expect(screen.getByText(/Wallet not connected/)).toBeInTheDocument();
  });
});