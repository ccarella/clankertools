import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientDeployment } from '@/components/deploy/ClientDeployment';
import { useWallet } from '@/providers/WalletProvider';
import { mockSDK as sdk } from '@/__mocks__/@farcaster/frame-sdk';
import { createPublicClient, createWalletClient } from 'viem';

// Mock dependencies
jest.mock('@/providers/WalletProvider');
jest.mock('viem');
jest.mock('clanker-sdk', () => ({
  Clanker: jest.fn().mockImplementation(() => ({
    deployToken: jest.fn(),
  })),
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
    
    // Default wallet state - connected
    mockUseWallet.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      chainId: 8453, // Base mainnet
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnecting: false,
      error: null,
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

    expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument();
  });

  it('should handle successful deployment', async () => {
    const { Clanker } = await import('clanker-sdk');
    const mockDeployToken = jest.fn().mockResolvedValue({
      tokenAddress: '0xabcd',
      transactionHash: '0x1234',
      poolAddress: '0xpool',
    });
    
    Clanker.mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));

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
      expect(mockDeployToken).toHaveBeenCalledWith({
        name: 'Test Token',
        symbol: 'TEST',
        imageUrl: 'https://example.com/image.png',
        description: 'Test token description',
        fundingSourceId: 0,
        creatorShareId: 0,
        rewardsConfig: {
          creatorAdmin: '0x1234567890123456789012345678901234567890',
          creatorRewardRecipient: '0x1234567890123456789012345678901234567890',
          creatorPercentage: 80,
        },
        marketCapLiquidity: '0.1',
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
    const { Clanker } = await import('clanker-sdk');
    const mockError = new Error('Deployment failed');
    const mockDeployToken = jest.fn().mockRejectedValue(mockError);
    
    Clanker.mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));

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
    const { Clanker } = await import('clanker-sdk');
    const mockDeployToken = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );
    
    Clanker.mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));

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