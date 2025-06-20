/**
 * @jest-environment node
 */
import { POST } from '../route';
import { uploadToIPFS } from '@/lib/ipfs';
import { NextRequest } from 'next/server';

// Mock uploadToIPFS
jest.mock('@/lib/ipfs');

// Mock NextRequest
class MockNextRequest {
  method: string;
  headers: Headers;
  private _body: unknown;
  
  constructor(url: string, init: RequestInit) {
    this.method = init.method || 'GET';
    this.headers = new Headers(init.headers as HeadersInit);
    this._body = init.body;
  }
  
  async json() {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }
}

describe('Prepare route', () => {
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.NEXT_PUBLIC_NETWORK = 'base-sepolia';
  });

  afterEach(() => {
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_NETWORK;
  });

  it('should successfully process PNG image and upload to IPFS', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);

    // Create a simple PNG base64 data URL
    const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const requestBody = {
      tokenName: 'Test Token',
      tokenSymbol: 'TEST',
      imageFile: pngBase64,
      description: 'Test description',
      userFid: 123,
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
      },
      body: JSON.stringify(requestBody),
    }) as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deploymentData).toEqual({
      name: 'Test Token',
      symbol: 'TEST',
      imageUrl: mockImageUrl,
      description: 'Test description',
      marketCap: '0.1',
      creatorReward: 80,
      deployerAddress: '0x1234567890123456789012345678901234567890',
    });

    // Verify uploadToIPFS was called with a Blob
    expect(mockUploadToIPFS).toHaveBeenCalledWith(expect.any(Blob));
    
    // Verify the Blob has the correct type
    const blobArg = mockUploadToIPFS.mock.calls[0][0];
    expect(blobArg.type).toBe('image/png');
  });

  it('should handle JPEG images correctly', async () => {
    const mockImageUrl = 'ipfs://QmTest456';
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);

    // JPEG base64 data URL
    const jpegBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
    
    const requestBody = {
      tokenName: 'JPEG Token',
      tokenSymbol: 'JPEG',
      imageFile: jpegBase64,
      description: '',
      userFid: 456,
      walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    };

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }) as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify the Blob has the correct type
    const blobArg = mockUploadToIPFS.mock.calls[0][0];
    expect(blobArg.type).toBe('image/jpeg');
  });

  it('should reject invalid base64 format', async () => {
    const requestBody = {
      tokenName: 'Test Token',
      tokenSymbol: 'TEST',
      imageFile: 'not-a-valid-base64-data-url',
      description: '',
      userFid: 123,
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }) as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to upload image');
    expect(data.errorDetails.type).toBe('UPLOAD_ERROR');
    expect(mockUploadToIPFS).not.toHaveBeenCalled();
  });

  it('should handle IPFS upload errors', async () => {
    mockUploadToIPFS.mockRejectedValue(new Error('Invalid file type. Only images are allowed (PNG, JPEG, GIF, WebP). Received: text/plain'));

    const pngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const requestBody = {
      tokenName: 'Test Token',
      tokenSymbol: 'TEST',
      imageFile: pngBase64,
      description: '',
      userFid: 123,
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }) as unknown as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to upload image');
    expect(data.errorDetails.details).toContain('Invalid file type');
  });
});