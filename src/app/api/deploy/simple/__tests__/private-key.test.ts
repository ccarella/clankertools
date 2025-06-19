/**
 * @jest-environment node
 */
import { POST } from '../route';
import { Clanker } from 'clanker-sdk';
import { uploadToIPFS } from '@/lib/ipfs';

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
  privateKeyToAccount: jest.fn(),
}));
jest.mock('viem/chains', () => ({
  base: {},
  baseSepolia: {},
}));

describe('Private Key Handling Tests', () => {
  const mockDeployToken = jest.fn();
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockPrivateKeyToAccount = jest.requireMock('viem/accounts').privateKeyToAccount;

  beforeEach(() => {
    jest.clearAllMocks();
    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));
    
    // Set up environment variables
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    
    // Mock viem clients
    const mockPublicClient = {
      waitForTransactionReceipt: jest.fn(),
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
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.INTERFACE_ADMIN;
    delete process.env.INTERFACE_REWARD_RECIPIENT;
    delete process.env.ALLOWED_ORIGINS;
  });

  it('should handle private key string format without 0x prefix', async () => {
    // Set private key without 0x prefix
    process.env.DEPLOYER_PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
    
    // Mock privateKeyToAccount to throw the error we're seeing
    mockPrivateKeyToAccount.mockImplementation(() => {
      throw new Error('invalid private key: expected ui8a of size 32, got string');
    });
    
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

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('invalid private key');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.type).toBe('CONFIGURATION_ERROR');
  });

  it('should successfully handle private key with 0x prefix', async () => {
    // Set private key with 0x prefix
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    // Mock successful account creation
    mockPrivateKeyToAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
    });
    
    // Mock successful transaction receipt
    const mockWaitForTransactionReceipt = jest.fn().mockResolvedValue({ 
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
      status: 'success' 
    });
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const viem = require('viem');
    viem.createPublicClient.mockReturnValue({
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
      getBlock: jest.fn().mockResolvedValue({ number: BigInt(12345) }),
    });
    
    mockUploadToIPFS.mockResolvedValue('ipfs://QmTest123');
    mockDeployToken.mockResolvedValue({ 
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' 
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
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tokenAddress).toBe('0x1234567890123456789012345678901234567890');
  });

  it('should validate private key format and length', async () => {
    // Set invalid private key (too short)
    process.env.DEPLOYER_PRIVATE_KEY = '0x123';
    
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

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid private key configuration');
    expect(data.errorDetails.type).toBe('CONFIGURATION_ERROR');
    expect(data.errorDetails.details).toContain('Invalid private key length');
    expect(data.debugInfo.step).toBe('private_key_validation');
  });
});