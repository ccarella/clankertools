import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientDeployment } from '@/components/deploy/ClientDeployment';
import { useWallet } from '@/providers/WalletProvider';
import { mockSDK as sdk } from '@/__mocks__/@farcaster/frame-sdk';
import { createPublicClient, createWalletClient } from 'viem';

// Mock dependencies
jest.mock('@/providers/WalletProvider');
jest.mock('viem');

// Create mock Clanker instance
const mockClankerInstance = {
  deployToken: jest.fn(),
};

jest.mock('clanker-sdk', () => ({
  Clanker: jest.fn(() => mockClankerInstance),
}));

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

describe('ClientDeployment', () => {
  const mockTokenData = {
    name: 'Test Token',
    symbol: 'TEST',
    imageUrl: 'https://example.com/image.png',
    description: 'Test token description',
    marketCap: '0.1',
    creatorReward: 80,
    deployerAddress: '0x1234567890123456789012345678901234567890',
  };

  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockClankerInstance.deployToken.mockClear();
    
    // Default wallet state - connected
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890',
      chainId: 8453, // Base mainnet
      connect: jest.fn(),
      disconnect: jest.fn(),
      isLoading: false,
      error: null,
      balance: null,
      networkName: 'Base',
    });

    // Mock Farcaster SDK wallet provider
    const mockProvider = {
      request: jest.fn(),
    };
    (sdk.wallet.getEthereumProvider as jest.Mock).mockResolvedValue(mockProvider);

    // Mock viem clients
    const mockPublicClient = { chain: { id: 8453 } };
    const mockWalletClient = { account: { address: '0x1234' } };
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);
    (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);
  });

  it('should render deployment button when wallet is connected', () => {
    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    expect(screen.getByRole('button', { name: /deploy token/i })).toBeInTheDocument();
  });

  it('should show error when wallet is not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
      chainId: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      isLoading: false,
      error: null,
      balance: null,
      networkName: null,
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument();
  });

  it('should handle successful deployment', async () => {
    mockClankerInstance.deployToken.mockResolvedValue({
      tokenAddress: '0xabcd',
      transactionHash: '0x1234',
      poolAddress: '0xpool',
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const deployButton = screen.getByRole('button', { name: /deploy token/i });
    fireEvent.click(deployButton);

    await waitFor(() => {
      expect(mockClankerInstance.deployToken).toHaveBeenCalledWith({
        name: 'Test Token',
        symbol: 'TEST',
        image: 'https://example.com/image.png',
        pool: {
          quoteToken: '0x4200000000000000000000000000000000000006',
          initialMarketCap: '0.1',
        },
        rewardsConfig: {
          creatorReward: 80,
          creatorAdmin: '0x1234567890123456789012345678901234567890',
          creatorRewardRecipient: '0x1234567890123456789012345678901234567890',
          interfaceAdmin: '0x1234567890123456789012345678901234567890',
          interfaceRewardRecipient: '0x1234567890123456789012345678901234567890',
        }
      });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith({
        tokenAddress: '0xabcd',
        transactionHash: '0x1234',
        poolAddress: '0xpool',
      });
    });
  });

  it('should handle deployment errors', async () => {
    const mockError = new Error('Deployment failed');
    mockClankerInstance.deployToken.mockRejectedValue(mockError);

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const deployButton = screen.getByRole('button', { name: /deploy token/i });
    fireEvent.click(deployButton);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(mockError);
    });
  });

  it('should show loading state during deployment', async () => {
    mockClankerInstance.deployToken.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const deployButton = screen.getByRole('button', { name: /deploy token/i });
    fireEvent.click(deployButton);

    await waitFor(() => {
      expect(screen.getByText(/deploying/i)).toBeInTheDocument();
    });
  });

  it('should use correct chain based on wallet chainId', async () => {
    // Test with Base Sepolia
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      chainId: 84532, // Base Sepolia
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnecting: false,
      error: null,
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const deployButton = screen.getByRole('button', { name: /deploy token/i });
    fireEvent.click(deployButton);

    await waitFor(() => {
      expect(createPublicClient).toHaveBeenCalledWith(
        expect.objectContaining({
          chain: expect.objectContaining({ id: 84532 }),
        })
      );
    });
  });

  it('should handle network switching if on wrong chain', async () => {
    const mockProvider = {
      request: jest.fn().mockImplementation((args) => {
        if (args.method === 'wallet_switchEthereumChain') {
          // Simulate chain switch
          mockUseWallet.mockReturnValue({
            isConnected: true,
            address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
            chainId: 8453, // Switched to Base mainnet
            connect: jest.fn(),
            disconnect: jest.fn(),
            isConnecting: false,
            error: null,
          });
          return Promise.resolve();
        }
        return Promise.resolve();
      }),
    };
    
    (sdk.wallet.getEthereumProvider as jest.Mock).mockResolvedValue(mockProvider);

    // Start on wrong chain
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      chainId: 1, // Ethereum mainnet (wrong chain)
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnecting: false,
      error: null,
    });

    render(
      <ClientDeployment
        tokenData={mockTokenData}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        targetChainId={8453}
      />
    );

    const deployButton = screen.getByRole('button', { name: /switch.*deploy/i });
    fireEvent.click(deployButton);

    await waitFor(() => {
      expect(mockProvider.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // 8453 in hex
      });
    });
  });
});