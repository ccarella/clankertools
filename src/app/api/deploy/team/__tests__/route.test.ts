/**
 * @jest-environment node
 */
/**
 * Tests for team token deployment API route
 * 
 * This test file covers:
 * - Team token deployment with member allocations
 * - Vesting schedule configuration
 * - Treasury allocation handling
 * - Validation of percentages and limits
 * - Authentication requirements
 * 
 * Note: Uncomment the POST import when the route is implemented
 */
import { POST } from '../route';
import { Clanker } from 'clanker-sdk';
import { uploadToIPFS } from '@/lib/ipfs';

// Mock the TransactionManager and dependencies
jest.mock('@/lib/transaction/TransactionManager');
jest.mock('@/lib/transaction/processors/tokenDeploymentProcessor');

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

// Mock transaction manager
const mockTransactionManager = {
  queueTransaction: jest.fn(),
  startAutoProcessing: jest.fn(),
};

// Mock the getTransactionManager function
import { getTransactionManager } from '@/lib/transaction/TransactionManager';
jest.mock('@/lib/redis', () => ({
  storeUserToken: jest.fn(),
}));
jest.mock('@/lib/network-config', () => ({
  getNetworkConfig: jest.fn().mockReturnValue({
    name: 'Base Sepolia',
    chainId: 84532,
    isMainnet: false,
    rpcUrl: 'https://base-sepolia.rpc.url',
  }),
}));
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    get: jest.fn(),
  })),
}));
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

describe('POST /api/deploy/team', () => {
  const mockDeployToken = jest.fn();
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockWaitForTransactionReceipt = jest.fn();
  const mockSendTransaction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));
    
    // Mock transaction manager
    getTransactionManager.mockReturnValue(mockTransactionManager);
    mockTransactionManager.queueTransaction.mockResolvedValue('tx_team_12345');
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
    process.env.INITIAL_MARKET_CAP = '0.1';
    process.env.CREATOR_REWARD = '80';
    process.env.KV_REST_API_URL = 'https://mock-redis-url';
    process.env.KV_REST_API_TOKEN = 'mock-redis-token';
    
    // Mock viem clients
    const mockPublicClient = {
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    };
    const mockWalletClient = {
      sendTransaction: mockSendTransaction,
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
    delete process.env.INITIAL_MARKET_CAP;
    delete process.env.CREATOR_REWARD;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('should queue team token deployment successfully', async () => {
    const mockTransactionId = 'tx_team_12345';
    
    mockTransactionManager.queueTransaction.mockResolvedValue(mockTransactionId);

    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 10,
        role: 'Co-founder',
        vestingMonths: 12
      },
      {
        address: '0x2222222222222222222222222222222222222222',
        percentage: 5,
        role: 'Developer',
        vestingMonths: 6
      }
    ]));
    formData.append('treasuryPercentage', '20');
    formData.append('treasuryAddress', '0x3333333333333333333333333333333333333333');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data).toEqual({
      success: true,
      transactionId: mockTransactionId,
      message: 'Team token deployment queued successfully',
      statusUrl: `/api/transaction/${mockTransactionId}`,
      teamMembers: expect.arrayContaining([
        expect.objectContaining({
          address: '0x1111111111111111111111111111111111111111',
          percentage: 10,
          role: 'Co-founder',
          vestingMonths: 12
        }),
        expect.objectContaining({
          address: '0x2222222222222222222222222222222222222222',
          percentage: 5,
          role: 'Developer',
          vestingMonths: 6
        })
      ]),
      treasuryAllocation: {
        percentage: 20,
        address: '0x3333333333333333333333333333333333333333'
      }
    });

    expect(mockTransactionManager.queueTransaction).toHaveBeenCalledWith(
      {
        type: 'team_token_deployment',
        payload: {
          name: 'Team Token',
          symbol: 'TEAM',
          imageFile: expect.any(Blob),
          fid: '123456',
          castContext: undefined,
          creatorFeePercentage: undefined,
          teamMembers: expect.arrayContaining([
            expect.objectContaining({
              address: '0x1111111111111111111111111111111111111111',
              percentage: 10,
              role: 'Co-founder',
              vestingMonths: 12
            })
          ]),
          treasuryAllocation: {
            percentage: 20,
            address: '0x3333333333333333333333333333333333333333'
          }
        },
      },
      {
        userId: 123456,
        description: 'Team token deployment: Team Token (TEAM) with 2 members',
      },
      'high'
    );
    expect(mockTransactionManager.startAutoProcessing).toHaveBeenCalledWith(5000);
  });

  it('should validate team member data', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: 'invalid-address',
        percentage: 10,
        role: 'Co-founder',
        vestingMonths: 12
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Invalid team member address');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.type).toBe('VALIDATION_ERROR');
  });

  it('should validate total percentage allocation', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 50,
        role: 'Co-founder',
        vestingMonths: 12
      },
      {
        address: '0x2222222222222222222222222222222222222222',
        percentage: 40,
        role: 'Developer',
        vestingMonths: 6
      }
    ]));
    formData.append('treasuryPercentage', '20'); // Total would be 110%
    formData.append('treasuryAddress', '0x3333333333333333333333333333333333333333');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Total allocation exceeds 100%');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.totalAllocation).toBe(110);
  });

  it('should validate vesting schedule configuration', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 10,
        role: 'Co-founder',
        vestingMonths: -1 // Invalid vesting period
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Invalid vesting period');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.type).toBe('VALIDATION_ERROR');
  });

  it('should handle treasury allocation', async () => {
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockImageUrl = 'ipfs://QmTest123';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: mockTokenAddress,
      txHash: mockTxHash 
    });
    mockWaitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: mockTxHash, 
      status: 'success' 
    });

    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([]));
    formData.append('treasuryPercentage', '30');
    formData.append('treasuryAddress', '0x3333333333333333333333333333333333333333');
    formData.append('treasuryVestingMonths', '24');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.treasuryAllocation).toEqual({
      percentage: 30,
      address: '0x3333333333333333333333333333333333333333',
      vestingMonths: 24
    });
  });

  it('should enforce maximum team members limit', async () => {
    const teamMembers = Array.from({ length: 11 }, (_, i) => ({
      address: `0x${(i + 1).toString().padStart(40, '0')}`,
      percentage: 1,
      role: `Member ${i + 1}`,
      vestingMonths: 12
    }));

    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify(teamMembers));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Maximum 10 team members allowed');
    expect(data.errorDetails.teamMemberCount).toBe(11);
  });

  it('should require authentication', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('teamMembers', JSON.stringify([]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
        // Missing authentication headers
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Authentication required');
  });

  it('should validate minimum allocation percentages', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 0.01, // Too small
        role: 'Advisor',
        vestingMonths: 6
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Minimum allocation is 0.1%');
  });

  it('should handle missing team members gracefully', async () => {
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockImageUrl = 'ipfs://QmTest123';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: mockTokenAddress,
      txHash: mockTxHash 
    });
    mockWaitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: mockTxHash, 
      status: 'success' 
    });

    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    // No team members provided

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.teamMembers).toEqual([]);
  });

  it('should prevent duplicate team member addresses', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 10,
        role: 'Co-founder',
        vestingMonths: 12
      },
      {
        address: '0x1111111111111111111111111111111111111111', // Duplicate
        percentage: 5,
        role: 'Also Co-founder',
        vestingMonths: 12
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Duplicate team member address');
  });

  it('should validate role string length', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 10,
        role: 'A'.repeat(51), // Too long
        vestingMonths: 12
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Role must be 50 characters or less');
  });

  it('should handle JSON parsing errors for team members', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', 'invalid-json');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Invalid team members data');
  });

  it('should validate maximum vesting period', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 10,
        role: 'Co-founder',
        vestingMonths: 61 // More than 5 years
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Maximum vesting period is 60 months');
  });

  it('should calculate and validate cliff periods', async () => {
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockImageUrl = 'ipfs://QmTest123';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: mockTokenAddress,
      txHash: mockTxHash 
    });
    mockWaitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: mockTxHash, 
      status: 'success' 
    });

    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 10,
        role: 'Co-founder',
        vestingMonths: 12,
        cliffMonths: 3
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.teamMembers[0].cliffMonths).toBe(3);
  });

  it('should reject cliff period longer than vesting period', async () => {
    const formData = new FormData();
    formData.append('name', 'Team Token');
    formData.append('symbol', 'TEAM');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('fid', '123456'); // Add authentication
    formData.append('teamMembers', JSON.stringify([
      {
        address: '0x1111111111111111111111111111111111111111',
        percentage: 10,
        role: 'Co-founder',
        vestingMonths: 6,
        cliffMonths: 12 // Cliff longer than vesting
      }
    ]));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/team', {
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
    expect(data.error).toContain('Cliff period cannot exceed vesting period');
  });
});