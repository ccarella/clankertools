/**
 * @jest-environment node
 */
import { POST } from '../route';
import { uploadToIPFS } from '@/lib/ipfs';
import { Clanker } from 'clanker-sdk';

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
    address: '0xtest...',
  }),
}));
jest.mock('viem/chains', () => ({
  base: {},
  baseSepolia: {},
}));

describe('Mini App Image Upload', () => {
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockDeployToken = jest.fn();
  const mockWaitForTransactionReceipt = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment
    process.env.PINATA_JWT = 'test-jwt-token';
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://clankertools.com';
    process.env.NEXT_PUBLIC_NETWORK = 'base-sepolia';

    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));

    // Mock viem clients
    const mockPublicClient = {
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    };
    const mockWalletClient = {
      sendTransaction: jest.fn(),
    };
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const viem = require('viem');
    viem.createPublicClient.mockReturnValue(mockPublicClient);
    viem.createWalletClient.mockReturnValue(mockWalletClient);
  });

  afterEach(() => {
    delete process.env.PINATA_JWT;
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.INTERFACE_ADMIN;
    delete process.env.INTERFACE_REWARD_RECIPIENT;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.NEXT_PUBLIC_NETWORK;
  });

  it('should handle image upload failure when PINATA_JWT is missing', async () => {
    delete process.env.PINATA_JWT;
    
    mockUploadToIPFS.mockRejectedValue(new Error('IPFS credentials not configured'));

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }), 'test.png');

    const request = new MockNextRequest('https://clankertools.com/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'https://clankertools.com',
        'user-agent': 'Farcaster/1.0', // Mini App user agent
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Image upload service not configured. Please contact support.');
    expect(mockUploadToIPFS).toHaveBeenCalled();
    expect(mockDeployToken).not.toHaveBeenCalled();
  });

  it('should successfully upload image and deploy token in Mini App context', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: mockTokenAddress,
      txHash: mockTxHash 
    });
    mockWaitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: mockTxHash, 
      status: 'success',
      blockNumber: BigInt(12345),
      contractAddress: mockTokenAddress
    });

    const imageBlob = new Blob(['fake image data'], { type: 'image/png' });
    const formData = new FormData();
    formData.append('name', 'Mini App Token');
    formData.append('symbol', 'MAT');
    formData.append('image', imageBlob, 'token-image.png');

    const request = new MockNextRequest('https://clankertools.com/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'https://clankertools.com',
        'user-agent': 'Farcaster/1.0',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tokenAddress).toBe(mockTokenAddress);
    expect(data.txHash).toBe(mockTxHash);
    expect(data.imageUrl).toBe(mockImageUrl);
    expect(data.network).toBe('Base Sepolia');
    expect(data.chainId).toBe(84532);

    expect(mockUploadToIPFS).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockDeployToken).toHaveBeenCalledWith({
      name: 'Mini App Token',
      symbol: 'MAT',
      image: mockImageUrl,
      pool: expect.any(Object),
      rewardsConfig: expect.any(Object),
    });
  });

  it('should handle large image files (>10MB)', async () => {
    // Create a large blob (11MB)
    const largeImageData = new Uint8Array(11 * 1024 * 1024);
    const largeBlob = new Blob([largeImageData], { type: 'image/png' });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', largeBlob, 'large-image.png');

    const request = new MockNextRequest('https://clankertools.com/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'https://clankertools.com',
        'user-agent': 'Farcaster/1.0',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Image file is too large (max 10MB)');
    expect(mockUploadToIPFS).not.toHaveBeenCalled();
  });

  it('should validate image file types', async () => {
    const invalidFileBlob = new Blob(['not an image'], { type: 'text/plain' });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', invalidFileBlob, 'document.txt');

    const request = new MockNextRequest('https://clankertools.com/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'https://clankertools.com',
        'user-agent': 'Farcaster/1.0',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid image type. Allowed types: PNG, JPEG, GIF, WebP');
    expect(mockUploadToIPFS).not.toHaveBeenCalled();
  });

  it('should handle IPFS upload network errors', async () => {
    mockUploadToIPFS.mockRejectedValue(new Error('IPFS upload failed: 500 Internal Server Error'));

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }), 'test.png');

    const request = new MockNextRequest('https://clankertools.com/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'https://clankertools.com',
        'user-agent': 'Farcaster/1.0',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Image upload service temporarily unavailable. Please try again.');
  });

  it('should work with base64 encoded images from Mini App', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
    });
    mockWaitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
      status: 'success',
      blockNumber: BigInt(12345),
      contractAddress: '0x1234567890123456789012345678901234567890'
    });

    // Simulate base64 image data from Mini App
    const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const base64Data = base64Image.split(',')[1];
    const binaryData = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(binaryData.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }
    const imageBlob = new Blob([uint8Array], { type: 'image/png' });

    const formData = new FormData();
    formData.append('name', 'Base64 Token');
    formData.append('symbol', 'B64');
    formData.append('image', imageBlob, 'base64-image.png');

    const request = new MockNextRequest('https://clankertools.com/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'https://clankertools.com',
        'user-agent': 'Farcaster/1.0',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUploadToIPFS).toHaveBeenCalledWith(expect.any(Blob));
  }, 10000); // 10 second timeout
});