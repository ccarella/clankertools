import { POST } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/transaction/TransactionManager');

describe('POST /api/deploy/fair', () => {
  let mockRequest: NextRequest;
  let mockTransactionManager: {
    createTransaction: jest.Mock;
    updateTransaction: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransactionManager = {
      createTransaction: jest.fn().mockResolvedValue({
        transactionId: 'test-tx-id',
        status: 'pending',
      }),
      updateTransaction: jest.fn(),
    };
    
    const transactionModule = jest.requireMock('@/lib/transaction/TransactionManager');
    transactionModule.TransactionManager = jest.fn(() => mockTransactionManager);
  });

  const createMockRequest = (body: unknown) => {
    return new NextRequest('http://localhost:3000/api/deploy/fair', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  it('should deploy fair launch token with valid data', async () => {
    const validBody = {
      fid: '123',
      tokenName: 'Fair Token',
      tokenSymbol: 'FAIR',
      description: 'A fair launch token',
      imageUrl: 'https://example.com/image.png',
      whitelist: ['user1', 'user2', 'user3'],
      minContribution: '0.01',
      maxContribution: '1.0',
      targetRaise: '100',
      launchStartTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      launchDuration: 86400, // 24 hours
      creatorWallet: '0x1234567890123456789012345678901234567890',
    };

    mockRequest = createMockRequest(validBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.transactionId).toBe('test-tx-id');
    expect(mockTransactionManager.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        fid: '123',
        type: 'fair_launch',
        tokenName: 'Fair Token',
        tokenSymbol: 'FAIR',
      })
    );
  });

  it('should validate required fields', async () => {
    const invalidBody = {
      fid: '123',
      tokenName: 'Fair Token',
      // Missing required fields
    };

    mockRequest = createMockRequest(invalidBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should validate contribution limits', async () => {
    const invalidBody = {
      fid: '123',
      tokenName: 'Fair Token',
      tokenSymbol: 'FAIR',
      description: 'A fair launch token',
      imageUrl: 'https://example.com/image.png',
      whitelist: ['user1'],
      minContribution: '2.0', // Min > Max
      maxContribution: '1.0',
      targetRaise: '100',
      launchStartTime: new Date(Date.now() + 3600000).toISOString(),
      launchDuration: 86400,
    };

    mockRequest = createMockRequest(invalidBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Minimum contribution must be less than maximum');
  });

  it('should validate launch time is in the future', async () => {
    const invalidBody = {
      fid: '123',
      tokenName: 'Fair Token',
      tokenSymbol: 'FAIR',
      description: 'A fair launch token',
      imageUrl: 'https://example.com/image.png',
      whitelist: ['user1'],
      minContribution: '0.01',
      maxContribution: '1.0',
      targetRaise: '100',
      launchStartTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      launchDuration: 86400,
    };

    mockRequest = createMockRequest(invalidBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Launch start time must be in the future');
  });

  it('should validate whitelist is not empty', async () => {
    const invalidBody = {
      fid: '123',
      tokenName: 'Fair Token',
      tokenSymbol: 'FAIR',
      description: 'A fair launch token',
      imageUrl: 'https://example.com/image.png',
      whitelist: [],
      minContribution: '0.01',
      maxContribution: '1.0',
      targetRaise: '100',
      launchStartTime: new Date(Date.now() + 3600000).toISOString(),
      launchDuration: 86400,
    };

    mockRequest = createMockRequest(invalidBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Whitelist must contain at least one user');
  });

  it('should validate launch duration is reasonable', async () => {
    const invalidBody = {
      fid: '123',
      tokenName: 'Fair Token',
      tokenSymbol: 'FAIR',
      description: 'A fair launch token',
      imageUrl: 'https://example.com/image.png',
      whitelist: ['user1'],
      minContribution: '0.01',
      maxContribution: '1.0',
      targetRaise: '100',
      launchStartTime: new Date(Date.now() + 3600000).toISOString(),
      launchDuration: 60, // 1 minute - too short
    };

    mockRequest = createMockRequest(invalidBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Launch duration must be between 1 hour and 7 days');
  });

  it('should generate merkle tree for whitelist', async () => {
    const validBody = {
      fid: '123',
      tokenName: 'Fair Token',
      tokenSymbol: 'FAIR',
      description: 'A fair launch token',
      imageUrl: 'https://example.com/image.png',
      whitelist: ['user1', 'user2', 'user3'],
      minContribution: '0.01',
      maxContribution: '1.0',
      targetRaise: '100',
      launchStartTime: new Date(Date.now() + 3600000).toISOString(),
      launchDuration: 86400,
      creatorWallet: '0x1234567890123456789012345678901234567890',
    };

    mockRequest = createMockRequest(validBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.merkleRoot).toBeDefined();
    expect(mockTransactionManager.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        merkleRoot: expect.any(String),
      })
    );
  });

  it('should handle server errors gracefully', async () => {
    mockTransactionManager.createTransaction.mockRejectedValue(new Error('Database error'));

    const validBody = {
      fid: '123',
      tokenName: 'Fair Token',
      tokenSymbol: 'FAIR',
      description: 'A fair launch token',
      imageUrl: 'https://example.com/image.png',
      whitelist: ['user1'],
      minContribution: '0.01',
      maxContribution: '1.0',
      targetRaise: '100',
      launchStartTime: new Date(Date.now() + 3600000).toISOString(),
      launchDuration: 86400,
    };

    mockRequest = createMockRequest(validBody);
    
    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to deploy fair launch token');
  });
});