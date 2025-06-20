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

describe('PNG Image Upload', () => {
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
    process.env.NEXT_PUBLIC_NETWORK = 'base-sepolia';

    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));

    // Mock viem clients
    const mockPublicClient = {
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
      getBlock: jest.fn().mockResolvedValue({ number: BigInt(12345) }),
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
    delete process.env.NEXT_PUBLIC_NETWORK;
  });

  it('should successfully upload PNG image and deploy token', async () => {
    const mockImageUrl = 'ipfs://QmPNGTest123';
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

    // Create a PNG blob
    const pngBlob = new Blob(['PNG image data'], { type: 'image/png' });
    const formData = new FormData();
    formData.append('name', 'PNG Test Token');
    formData.append('symbol', 'PNGTEST');
    formData.append('image', pngBlob, 'test-image.png');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
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

    // Verify uploadToIPFS was called with a PNG blob
    expect(mockUploadToIPFS).toHaveBeenCalledWith(expect.objectContaining({
      type: 'image/png'
    }));

    // Verify deployment was called with correct parameters
    expect(mockDeployToken).toHaveBeenCalledWith(expect.objectContaining({
      name: 'PNG Test Token',
      symbol: 'PNGTEST',
      image: mockImageUrl,
    }));
  });

  it('should handle various PNG file names', async () => {
    const mockImageUrl = 'ipfs://QmPNGVariations';
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

    const testCases = [
      'image.png',
      'IMAGE.PNG',
      'test-image.png',
      'test_image.png',
      'test.image.png',
      '123.png',
      'logo-dark.png',
    ];

    for (const fileName of testCases) {
      jest.clearAllMocks();
      
      const pngBlob = new Blob(['PNG data'], { type: 'image/png' });
      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', pngBlob, fileName);

      const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
        method: 'POST',
        body: formData,
        headers: {
          'origin': 'http://localhost:3000',
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUploadToIPFS).toHaveBeenCalledWith(expect.objectContaining({
        type: 'image/png'
      }));
    }
  });

  it('should validate PNG file size', async () => {
    // Create a large PNG blob (11MB)
    const largeData = new Uint8Array(11 * 1024 * 1024);
    const largePngBlob = new Blob([largeData], { type: 'image/png' });

    const formData = new FormData();
    formData.append('name', 'Large PNG Token');
    formData.append('symbol', 'BIGPNG');
    formData.append('image', largePngBlob, 'large.png');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
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

  it('should reject non-PNG files even with .png extension', async () => {
    // Create a text file masquerading as PNG
    const textBlob = new Blob(['Not a PNG'], { type: 'text/plain' });
    
    const formData = new FormData();
    formData.append('name', 'Fake PNG Token');
    formData.append('symbol', 'FAKE');
    formData.append('image', textBlob, 'fake.png'); // PNG filename but wrong MIME type

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
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
});