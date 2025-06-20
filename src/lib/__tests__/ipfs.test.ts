import { uploadToIPFS, getIpfsUrl } from '../ipfs';

// Mock fetch globally
global.fetch = jest.fn();

describe('uploadToIPFS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PINATA_JWT = 'test-jwt-token';
  });

  afterEach(() => {
    delete process.env.PINATA_JWT;
  });

  it('should upload image to IPFS successfully', async () => {
    const mockCid = 'bafybeihgxdzljxb26q6nf3r3eifqeedsvt2eubqtskghpme66cgjyw4fra';
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          id: '349f1bb2-5d59-4cab-9966-e94c028a05b7',
          name: 'clanker-token-123456789',
          cid: mockCid,
          size: 10,
          number_of_files: 1,
          mime_type: 'image/png',
          group_id: null
        }
      }),
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    const result = await uploadToIPFS(imageBlob);

    expect(result).toBe(`ipfs://${mockCid}`);
    expect(fetch).toHaveBeenCalledWith(
      'https://uploads.pinata.cloud/v3/files',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-jwt-token',
        }),
        body: expect.any(FormData),
      })
    );
  });

  it('should throw error when IPFS credentials are missing', async () => {
    delete process.env.PINATA_JWT;

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    
    await expect(uploadToIPFS(imageBlob)).rejects.toThrow('IPFS credentials not configured');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should handle IPFS API errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: jest.fn().mockResolvedValue('Server error details'),
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    
    await expect(uploadToIPFS(imageBlob)).rejects.toThrow('IPFS upload failed: 500 Internal Server Error');
  });

  it('should handle network errors', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    
    await expect(uploadToIPFS(imageBlob)).rejects.toThrow('Network error');
  });

  it('should add metadata to the upload', async () => {
    const mockCid = 'bafybeihgxdzljxb26q6nf3r3eifqeedsvt2eubqtskghpme66cgjyw4fra';
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          id: '349f1bb2',
          cid: mockCid,
          size: 10,
          number_of_files: 1,
          mime_type: 'image/png',
          group_id: null
        }
      }),
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    await uploadToIPFS(imageBlob);

    const callArgs = (fetch as jest.Mock).mock.calls[0];
    const formData = callArgs[1].body as FormData;
    
    // Verify metadata was added
    const metadata = formData.get('pinataMetadata');
    expect(metadata).toBeTruthy();
    const parsedMetadata = JSON.parse(metadata as string);
    expect(parsedMetadata.name).toMatch(/^clanker-token-/);
  });

  it('should handle invalid response format', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        // Missing cid field
        success: true,
      }),
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    
    await expect(uploadToIPFS(imageBlob)).rejects.toThrow('Invalid response from IPFS');
  });

  it('should validate file size', async () => {
    // Create a blob that's too large (over 10MB)
    const largeData = new Uint8Array(11 * 1024 * 1024); // 11MB
    const largeBlob = new Blob([largeData], { type: 'image/png' });
    
    await expect(uploadToIPFS(largeBlob)).rejects.toThrow('File size exceeds 10MB limit');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should validate file type', async () => {
    const invalidBlob = new Blob(['data'], { type: 'text/plain' });
    
    await expect(uploadToIPFS(invalidBlob)).rejects.toThrow('Invalid file type. Only images are allowed (PNG, JPEG, GIF, WebP). Received: text/plain');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('getIpfsUrl', () => {
  it('should return empty string for empty input', () => {
    expect(getIpfsUrl('')).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getIpfsUrl(null as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getIpfsUrl(undefined as any)).toBe('');
  });

  it('should return HTTP URLs as is', () => {
    const httpUrl = 'http://example.com/image.png';
    const httpsUrl = 'https://example.com/image.png';
    
    expect(getIpfsUrl(httpUrl)).toBe(httpUrl);
    expect(getIpfsUrl(httpsUrl)).toBe(httpsUrl);
  });

  it('should convert ipfs:// URLs to gateway URLs', () => {
    const ipfsUrl = 'ipfs://QmTest123456789';
    const expectedUrl = 'https://gateway.pinata.cloud/ipfs/QmTest123456789';
    
    expect(getIpfsUrl(ipfsUrl)).toBe(expectedUrl);
  });

  it('should handle raw IPFS hashes', () => {
    const hash = 'QmTest123456789';
    const expectedUrl = 'https://gateway.pinata.cloud/ipfs/QmTest123456789';
    
    expect(getIpfsUrl(hash)).toBe(expectedUrl);
  });
});