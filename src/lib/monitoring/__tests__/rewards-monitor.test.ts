import {
  fetchDeploymentData,
  calculateExpectedRewards,
  detectDiscrepancies,
  generateWeeklyReport,
  storeDeploymentForMonitoring,
  DeploymentData,
  OnChainRewards,
} from '../rewards-monitor';

// Mock Redis
jest.mock('@upstash/redis');
jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(() => mockRedis),
}));

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
};

describe('Rewards Monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchDeploymentData', () => {
    it('should fetch deployments within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');
      
      const mockDeployments: DeploymentData[] = [
        {
          tokenAddress: '0x1234567890123456789012345678901234567890',
          tokenName: 'Test Token 1',
          tokenSymbol: 'TEST1',
          creatorAddress: '0xabcdef1234567890123456789012345678901234',
          creatorFid: '12345',
          deploymentDate: '2024-01-03T10:00:00Z',
          transactionHash: '0x' + '1'.repeat(64),
          feeConfiguration: {
            creatorFeePercentage: 80,
            platformFeePercentage: 20,
            totalFeePercentage: 1,
          },
          expectedCreatorPercentage: 80,
          expectedPlatformPercentage: 20,
          network: 'base',
        },
      ];
      
      mockRedis.get.mockResolvedValueOnce(mockDeployments);
      mockRedis.keys.mockResolvedValue([]);
      
      const result = await fetchDeploymentData(startDate, endDate);
      
      expect(result).toHaveLength(1);
      expect(result[0].tokenAddress).toBe(mockDeployments[0].tokenAddress);
    });

    it('should handle empty date ranges', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');
      
      mockRedis.get.mockResolvedValue(null);
      mockRedis.keys.mockResolvedValue([]);
      
      const result = await fetchDeploymentData(startDate, endDate);
      
      expect(result).toEqual([]);
    });

    it('should deduplicate deployments by token address', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      
      const duplicateDeployment: DeploymentData = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        creatorAddress: '0xabcdef1234567890123456789012345678901234',
        creatorFid: '12345',
        deploymentDate: '2024-01-01T10:00:00Z',
        transactionHash: '0x' + '1'.repeat(64),
        feeConfiguration: {
          creatorFeePercentage: 80,
          platformFeePercentage: 20,
          totalFeePercentage: 1,
        },
        expectedCreatorPercentage: 80,
        expectedPlatformPercentage: 20,
        network: 'base',
      };
      
      mockRedis.get.mockResolvedValueOnce([duplicateDeployment, duplicateDeployment]);
      mockRedis.keys.mockResolvedValue([]);
      
      const result = await fetchDeploymentData(startDate, endDate);
      
      expect(result).toHaveLength(1);
    });
  });

  describe('calculateExpectedRewards', () => {
    it('should calculate 80/20 split by default', () => {
      const deployment: DeploymentData = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        creatorAddress: '0xabcdef1234567890123456789012345678901234',
        creatorFid: '12345',
        deploymentDate: '2024-01-01T10:00:00Z',
        transactionHash: '0x' + '1'.repeat(64),
        feeConfiguration: {
          creatorFeePercentage: 80,
          platformFeePercentage: 20,
          totalFeePercentage: 1,
        },
        expectedCreatorPercentage: 80,
        expectedPlatformPercentage: 20,
        network: 'base',
      };
      
      const result = calculateExpectedRewards(deployment);
      
      expect(result.expectedCreatorPercentage).toBe(80);
      expect(result.expectedPlatformPercentage).toBe(20);
      expect(result.expectedSplit.creator).toBe(80);
      expect(result.expectedSplit.platform).toBe(20);
    });

    it('should handle custom fee splits', () => {
      const deployment: DeploymentData = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        creatorAddress: '0xabcdef1234567890123456789012345678901234',
        creatorFid: '12345',
        deploymentDate: '2024-01-01T10:00:00Z',
        transactionHash: '0x' + '1'.repeat(64),
        feeConfiguration: {
          creatorFeePercentage: 90,
          platformFeePercentage: 10,
          totalFeePercentage: 1,
        },
        expectedCreatorPercentage: 90,
        expectedPlatformPercentage: 10,
        network: 'base',
      };
      
      const result = calculateExpectedRewards(deployment);
      
      expect(result.expectedCreatorPercentage).toBe(90);
      expect(result.expectedPlatformPercentage).toBe(10);
    });
  });

  describe('detectDiscrepancies', () => {
    const deployment: DeploymentData = {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'Test Token',
      tokenSymbol: 'TEST',
      creatorAddress: '0xabcdef1234567890123456789012345678901234',
      creatorFid: '12345',
      deploymentDate: '2024-01-01T10:00:00Z',
      transactionHash: '0x' + '1'.repeat(64),
      feeConfiguration: {
        creatorFeePercentage: 80,
        platformFeePercentage: 20,
        totalFeePercentage: 1,
      },
      expectedCreatorPercentage: 80,
      expectedPlatformPercentage: 20,
      network: 'base',
    };

    it('should detect high severity discrepancies', () => {
      const onChainRewards: OnChainRewards = {
        tokenAddress: deployment.tokenAddress,
        totalFeesCollected: BigInt(1000000),
        creatorFeesReceived: BigInt(700000), // 70% instead of 80%
        platformFeesReceived: BigInt(300000),
        creatorPercentage: 70,
        platformPercentage: 30,
        lastUpdated: '2024-01-02T10:00:00Z',
      };
      
      const discrepancy = detectDiscrepancies(deployment, onChainRewards);
      
      expect(discrepancy).not.toBeNull();
      expect(discrepancy?.severity).toBe('high');
      expect(discrepancy?.percentageDifference).toBe(10);
      expect(discrepancy?.expectedCreatorPercentage).toBe(80);
      expect(discrepancy?.actualCreatorPercentage).toBe(70);
    });

    it('should detect medium severity discrepancies', () => {
      const onChainRewards: OnChainRewards = {
        tokenAddress: deployment.tokenAddress,
        totalFeesCollected: BigInt(1000000),
        creatorFeesReceived: BigInt(770000), // 77% instead of 80%
        platformFeesReceived: BigInt(230000),
        creatorPercentage: 77,
        platformPercentage: 23,
        lastUpdated: '2024-01-02T10:00:00Z',
      };
      
      const discrepancy = detectDiscrepancies(deployment, onChainRewards);
      
      expect(discrepancy).not.toBeNull();
      expect(discrepancy?.severity).toBe('medium');
      expect(discrepancy?.percentageDifference).toBe(3);
    });

    it('should return null for negligible discrepancies', () => {
      const onChainRewards: OnChainRewards = {
        tokenAddress: deployment.tokenAddress,
        totalFeesCollected: BigInt(1000000),
        creatorFeesReceived: BigInt(799500), // 79.95% instead of 80%
        platformFeesReceived: BigInt(200500),
        creatorPercentage: 79.95,
        platformPercentage: 20.05,
        lastUpdated: '2024-01-02T10:00:00Z',
      };
      
      const discrepancy = detectDiscrepancies(deployment, onChainRewards);
      
      expect(discrepancy).toBeNull();
    });

    it('should return null when no fees collected', () => {
      const onChainRewards: OnChainRewards = {
        tokenAddress: deployment.tokenAddress,
        totalFeesCollected: BigInt(0),
        creatorFeesReceived: BigInt(0),
        platformFeesReceived: BigInt(0),
        creatorPercentage: 0,
        platformPercentage: 0,
        lastUpdated: '2024-01-02T10:00:00Z',
      };
      
      const discrepancy = detectDiscrepancies(deployment, onChainRewards);
      
      expect(discrepancy).toBeNull();
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate empty report for no deployments', async () => {
      const report = await generateWeeklyReport([]);
      
      expect(report.totalDeployments).toBe(0);
      expect(report.deploymentsWithDiscrepancies).toBe(0);
      expect(report.totalFeesCollected).toBe(BigInt(0));
      expect(report.discrepancies).toEqual([]);
    });

    it('should aggregate deployment statistics', async () => {
      const deployments: DeploymentData[] = [
        {
          tokenAddress: '0x1234567890123456789012345678901234567890',
          tokenName: 'Test Token 1',
          tokenSymbol: 'TEST1',
          creatorAddress: '0xabcdef1234567890123456789012345678901234',
          creatorFid: '12345',
          deploymentDate: '2024-01-01T10:00:00Z',
          transactionHash: '0x' + '1'.repeat(64),
          feeConfiguration: {
            creatorFeePercentage: 80,
            platformFeePercentage: 20,
            totalFeePercentage: 1,
          },
          expectedCreatorPercentage: 80,
          expectedPlatformPercentage: 20,
          network: 'base',
        },
        {
          tokenAddress: '0x2345678901234567890123456789012345678901',
          tokenName: 'Test Token 2',
          tokenSymbol: 'TEST2',
          creatorAddress: '0xabcdef1234567890123456789012345678901234',
          creatorFid: '12345',
          deploymentDate: '2024-01-02T10:00:00Z',
          transactionHash: '0x' + '2'.repeat(64),
          feeConfiguration: {
            creatorFeePercentage: 80,
            platformFeePercentage: 20,
            totalFeePercentage: 1,
          },
          expectedCreatorPercentage: 80,
          expectedPlatformPercentage: 20,
          network: 'base',
        },
      ];
      
      const report = await generateWeeklyReport(deployments);
      
      expect(report.totalDeployments).toBe(2);
      expect(report.deploymentsByDay['2024-01-01']).toBe(1);
      expect(report.deploymentsByDay['2024-01-02']).toBe(1);
    });
  });

  describe('storeDeploymentForMonitoring', () => {
    it('should store valid deployment data', async () => {
      const deployment: DeploymentData = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        creatorAddress: '0xabcdef1234567890123456789012345678901234',
        creatorFid: '12345',
        deploymentDate: '2024-01-01T10:00:00Z',
        transactionHash: '0x' + '1'.repeat(64),
        feeConfiguration: {
          creatorFeePercentage: 80,
          platformFeePercentage: 20,
          totalFeePercentage: 1,
        },
        expectedCreatorPercentage: 80,
        expectedPlatformPercentage: 20,
        network: 'base',
      };
      
      mockRedis.get.mockResolvedValue([]);
      
      await storeDeploymentForMonitoring(deployment);
      
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.expire).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid deployment data', async () => {
      const invalidDeployment = {
        tokenAddress: 'invalid-address',
        tokenName: 'Test Token',
      } as DeploymentData;
      
      await expect(storeDeploymentForMonitoring(invalidDeployment)).rejects.toThrow();
    });
  });
});