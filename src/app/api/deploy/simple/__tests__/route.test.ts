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
  
  constructor(url: string, init: RequestInit) {
    this.method = init.method || 'GET';
    this.body = init.body as FormData;
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
    address: '0xtest...',
  }),
}));
jest.mock('viem/chains', () => ({
  base: {},
}));

describe('POST /api/deploy/simple', () => {
  const mockDeployToken = jest.fn();
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockTrackTransaction = trackTransaction as jest.MockedFunction<typeof trackTransaction>;

  beforeEach(() => {
    jest.clearAllMocks();
    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
  });

  afterEach(() => {
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.INTERFACE_ADMIN;
    delete process.env.INTERFACE_REWARD_RECIPIENT;
  });

  it('should deploy a token successfully', async () => {
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const mockImageUrl = 'ipfs://QmTest123';

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({
      tokenAddress: mockTokenAddress,
      txHash: mockTxHash,
    });
    mockTrackTransaction.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      tokenAddress: mockTokenAddress,
      txHash: mockTxHash,
      imageUrl: mockImageUrl,
    });

    expect(mockUploadToIPFS).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockDeployToken).toHaveBeenCalledWith({
      name: 'Test Token',
      symbol: 'TEST',
      image: mockImageUrl,
      pool: {
        quoteToken: '0x4200000000000000000000000000000000000006',
        initialMarketCap: '0.1',
      },
      rewardsConfig: {
        creatorReward: 80,
        creatorAdmin: '0xtest...',
        creatorRewardRecipient: '0xtest...',
        interfaceAdmin: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
        interfaceRewardRecipient: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
      },
    });
    expect(mockTrackTransaction).toHaveBeenCalledWith(mockTxHash, {
      type: 'token_deployment',
      tokenAddress: mockTokenAddress,
      name: 'Test Token',
      symbol: 'TEST',
    });
  });

  it('should handle missing required fields', async () => {
    const formData = new FormData();
    formData.append('name', 'Test Token');
    // Missing symbol and image

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Missing required fields: name, symbol, and image',
    });

    expect(mockUploadToIPFS).not.toHaveBeenCalled();
    expect(mockDeployToken).not.toHaveBeenCalled();
  });

  it('should handle missing environment variables', async () => {
    delete process.env.DEPLOYER_PRIVATE_KEY;

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    await response.json();

    expect(response.status).toBe(500);
  });

  it('should handle IPFS upload failure', async () => {
    mockUploadToIPFS.mockRejectedValue(new Error('IPFS upload failed'));

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: 'Failed to upload image',
    });

    expect(mockDeployToken).not.toHaveBeenCalled();
  });

  it('should handle deployment failure with retry', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    
    // First attempt fails, second succeeds
    mockDeployToken
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        tokenAddress: '0x1234567890123456789012345678901234567890',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    await response.json();

    expect(response.status).toBe(200);
    expect(mockDeployToken).toHaveBeenCalledTimes(2);
  });

  it('should fail after maximum retry attempts', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    
    // All attempts fail
    mockDeployToken.mockRejectedValue(new Error('Network error'));

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: 'Token deployment failed after 3 attempts',
    });

    expect(mockDeployToken).toHaveBeenCalledTimes(3);
  });

  it('should validate token name length', async () => {
    const formData = new FormData();
    formData.append('name', 'A'.repeat(33)); // Too long
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Token name must be 32 characters or less',
    });
  });

  it('should validate symbol length and format', async () => {
    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TOOLONGSYMBOL'); // Too long
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Symbol must be between 3 and 8 characters',
    });
  });

  it('should handle non-POST requests', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'GET',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(405);
    expect(data).toEqual({
      success: false,
      error: 'Method not allowed',
    });
  });
});