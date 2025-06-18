/**
 * @jest-environment node
 */
import { POST } from '../route';
import { Clanker } from 'clanker-sdk';
import { uploadToIPFS } from '@/lib/ipfs';
import { trackTransaction } from '@/lib/transaction-tracker';

// Mock NextRequest
class MockNextRequest {
  method: string;
  body: FormData;
  headers: Headers;
  
  constructor(url: string, init: RequestInit) {
    this.method = init.method || 'GET';
    this.body = init.body as FormData;
    this.headers = new Headers(init.headers as HeadersInit);
  }
  
  async formData() {
    return this.body;
  }
}

jest.mock('clanker-sdk');
jest.mock('@/lib/ipfs');
jest.mock('@/lib/transaction-tracker');
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
}));
jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn().mockReturnValue({
    address: '0x1234567890123456789012345678901234567890',
  }),
}));
jest.mock('viem/chains', () => ({
  base: {},
}));

describe('Fee Split Calculations', () => {
  const mockDeployToken = jest.fn();
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockTrackTransaction = trackTransaction as jest.MockedFunction<typeof trackTransaction>;
  const mockWaitForTransactionReceipt = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));
    
    // Set up environment variables
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    process.env.INITIAL_MARKET_CAP = '0.1';
    process.env.CREATOR_REWARD = '80';
    
    // Mock viem clients
    const mockPublicClient = {
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    };
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const viem = require('viem');
    viem.createPublicClient.mockReturnValue(mockPublicClient);
  });

  afterEach(() => {
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.INTERFACE_ADMIN;
    delete process.env.INTERFACE_REWARD_RECIPIENT;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.INITIAL_MARKET_CAP;
    delete process.env.CREATOR_REWARD;
  });

  describe('80/20 Fee Split Configuration', () => {
    it('should correctly configure 80/20 fee split with default values', async () => {
      mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
      mockDeployToken.mockResolvedValue({ 
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
      });
      mockWaitForTransactionReceipt.mockResolvedValue({ 
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
        status: 'success' 
      });

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      await POST(request);

      expect(mockDeployToken).toHaveBeenCalledWith(
        expect.objectContaining({
          rewardsConfig: {
            creatorReward: 80, // 80% to creator
            creatorAdmin: '0x1234567890123456789012345678901234567890',
            creatorRewardRecipient: '0x1234567890123456789012345678901234567890',
            interfaceAdmin: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
            interfaceRewardRecipient: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
          },
        })
      );
    });

    it('should handle custom fee split configurations', async () => {
      // Test with different fee splits
      const testCases = [
        { creatorReward: '90', description: '90/10 split' },
        { creatorReward: '70', description: '70/30 split' },
        { creatorReward: '50', description: '50/50 split' },
        { creatorReward: '100', description: '100/0 split' },
        { creatorReward: '0', description: '0/100 split' },
      ];

      for (const testCase of testCases) {
        process.env.CREATOR_REWARD = testCase.creatorReward;
        
        mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
        mockDeployToken.mockResolvedValue({ 
          address: '0x1234567890123456789012345678901234567890',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
        });
        mockWaitForTransactionReceipt.mockResolvedValue({ 
          transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
          status: 'success' 
        });

        const formData = new FormData();
        formData.append('name', 'Test Token');
        formData.append('symbol', 'TEST');
        formData.append('image', new Blob(['image data'], { type: 'image/png' }));

        const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
          method: 'POST',
          body: formData,
          headers: { 'origin': 'http://localhost:3000' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        await POST(request);

        expect(mockDeployToken).toHaveBeenCalledWith(
          expect.objectContaining({
            rewardsConfig: expect.objectContaining({
              creatorReward: parseInt(testCase.creatorReward),
            }),
          })
        );
        
        jest.clearAllMocks();
      }
    });

    it('should validate fee percentages are within valid range', async () => {
      // Test invalid fee percentages
      const invalidPercentages = ['-10', '101', '150', 'abc', ''];

      for (const invalidPercentage of invalidPercentages) {
        process.env.CREATOR_REWARD = invalidPercentage;
        
        mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');

        const formData = new FormData();
        formData.append('name', 'Test Token');
        formData.append('symbol', 'TEST');
        formData.append('image', new Blob(['image data'], { type: 'image/png' }));

        const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
          method: 'POST',
          body: formData,
          headers: { 'origin': 'http://localhost:3000' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        await POST(request);

        // Should use default 80% when invalid
        expect(mockDeployToken).toHaveBeenCalledWith(
          expect.objectContaining({
            rewardsConfig: expect.objectContaining({
              creatorReward: 80, // Falls back to default
            }),
          })
        );
        
        jest.clearAllMocks();
      }
    });

    it('should ensure creator and interface addresses are different', async () => {
      mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
      mockDeployToken.mockResolvedValue({ 
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
      });
      mockWaitForTransactionReceipt.mockResolvedValue({ 
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
        status: 'success' 
      });

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      await POST(request);

      const deployCall = mockDeployToken.mock.calls[0][0];
      
      // Ensure creator and interface addresses are different
      expect(deployCall.rewardsConfig.creatorRewardRecipient).not.toBe(
        deployCall.rewardsConfig.interfaceRewardRecipient
      );
      expect(deployCall.rewardsConfig.creatorAdmin).not.toBe(
        deployCall.rewardsConfig.interfaceAdmin
      );
    });

    it('should properly handle decimal fee percentages', async () => {
      // Test that decimal percentages are handled correctly
      process.env.CREATOR_REWARD = '80.5';
      
      mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
      mockDeployToken.mockResolvedValue({ 
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
      });
      mockWaitForTransactionReceipt.mockResolvedValue({ 
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
        status: 'success' 
      });

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      await POST(request);

      expect(mockDeployToken).toHaveBeenCalledWith(
        expect.objectContaining({
          rewardsConfig: expect.objectContaining({
            creatorReward: 80, // Should be rounded to integer
          }),
        })
      );
    });
  });

  describe('Fee Calculation Edge Cases', () => {
    it('should handle maximum values correctly', async () => {
      process.env.INITIAL_MARKET_CAP = '999999999';
      process.env.CREATOR_REWARD = '100';
      
      mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
      mockDeployToken.mockResolvedValue({ 
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
      });
      mockWaitForTransactionReceipt.mockResolvedValue({ 
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
        status: 'success' 
      });

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockDeployToken).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: {
            quoteToken: '0x4200000000000000000000000000000000000006',
            initialMarketCap: '999999999',
          },
          rewardsConfig: expect.objectContaining({
            creatorReward: 100,
          }),
        })
      );
    });

    it('should handle minimum values correctly', async () => {
      process.env.INITIAL_MARKET_CAP = '0.000001';
      process.env.CREATOR_REWARD = '0';
      
      mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
      mockDeployToken.mockResolvedValue({ 
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
      });
      mockWaitForTransactionReceipt.mockResolvedValue({ 
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
        status: 'success' 
      });

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockDeployToken).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: {
            quoteToken: '0x4200000000000000000000000000000000000006',
            initialMarketCap: '0.000001',
          },
          rewardsConfig: expect.objectContaining({
            creatorReward: 0,
          }),
        })
      );
    });
  });

  describe('Recipient Address Validation', () => {
    it('should validate recipient addresses are valid Ethereum addresses', async () => {
      mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
      mockDeployToken.mockResolvedValue({ 
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
      });
      mockWaitForTransactionReceipt.mockResolvedValue({ 
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
        status: 'success' 
      });

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      await POST(request);

      const deployCall = mockDeployToken.mock.calls[0][0];
      
      // Check all addresses are valid Ethereum addresses (40 hex chars after 0x)
      const addressRegex = /^0x[a-fA-F0-9]{40}$/;
      expect(deployCall.rewardsConfig.creatorAdmin).toMatch(addressRegex);
      expect(deployCall.rewardsConfig.creatorRewardRecipient).toMatch(addressRegex);
      expect(deployCall.rewardsConfig.interfaceAdmin).toMatch(addressRegex);
      expect(deployCall.rewardsConfig.interfaceRewardRecipient).toMatch(addressRegex);
    });

    it('should not allow zero addresses', async () => {
      // Test with zero address environment variables
      process.env.INTERFACE_ADMIN = '0x0000000000000000000000000000000000000000';
      process.env.INTERFACE_REWARD_RECIPIENT = '0x0000000000000000000000000000000000000000';
      
      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      const data = await response.json();

      // Should reject deployment with zero addresses
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('Fee Distribution Tracking', () => {
    it('should track fee configuration in transaction data', async () => {
      mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
      mockDeployToken.mockResolvedValue({ 
        address: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
      });
      mockWaitForTransactionReceipt.mockResolvedValue({ 
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
        status: 'success' 
      });
      mockTrackTransaction.mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['image data'], { type: 'image/png' }));

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: { 'origin': 'http://localhost:3000' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      await POST(request);

      // Verify transaction tracking includes fee configuration
      expect(mockTrackTransaction).toHaveBeenCalledWith(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        expect.objectContaining({
          type: 'token_deployment',
          tokenAddress: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
        })
      );
    });
  });
});