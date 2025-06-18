import { uploadToIPFS } from '../ipfs';

// Mock fetch globally
global.fetch = jest.fn();

describe('uploadToIPFS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IPFS_API_KEY = 'test-api-key';
    process.env.IPFS_API_SECRET = 'test-api-secret';
  });

  afterEach(() => {
    delete process.env.IPFS_API_KEY;
    delete process.env.IPFS_API_SECRET;
  });

  it('should upload image to IPFS successfully', async () => {
    const mockHash = 'QmTest123456789';
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        Hash: mockHash,
      }),
    };
    (fetch as jest.Mock).mockResolvedValue(mockResponse);

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    const result = await uploadToIPFS(imageBlob);

    expect(result).toBe(`ipfs://${mockHash}`);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'pinata_api_key': 'test-api-key',
          'pinata_secret_api_key': 'test-api-secret',
        }),
        body: expect.any(FormData),
      })
    );
  });

  it('should throw error when IPFS credentials are missing', async () => {
    delete process.env.IPFS_API_KEY;

    const imageBlob = new Blob(['image data'], { type: 'image/png' });
    
    await expect(uploadToIPFS(imageBlob)).rejects.toThrow('IPFS credentials not configured');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should handle IPFS API errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
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
    const mockHash = 'QmTest123456789';
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        Hash: mockHash,
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
        // Missing Hash field
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
    
    await expect(uploadToIPFS(invalidBlob)).rejects.toThrow('Invalid file type. Only images are allowed');
    expect(fetch).not.toHaveBeenCalled();
  });
});