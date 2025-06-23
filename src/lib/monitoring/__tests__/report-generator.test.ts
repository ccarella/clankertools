import { generateWeeklyReport, getReportHistory, generateMarkdownReport } from '../report-generator';
import * as rewardsMonitor from '../rewards-monitor';
import { getRedisClient } from '@/lib/redis';

jest.mock('@/lib/redis');
jest.mock('../rewards-monitor');

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
};

(getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

describe('Report Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockDeploymentData: rewardsMonitor.DeploymentData[] = [
    {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'Test Token 1',
      tokenSymbol: 'TEST1',
      creatorAddress: '0xabcdef1234567890123456789012345678901234',
      creatorFid: '12345',
      deploymentDate: '2024-01-15T10:00:00Z',
      transactionHash: '0xabc1234567890123456789012345678901234567890123456789012345678901',
      feeConfiguration: {
        creatorFeePercentage: 80,
        platformFeePercentage: 20,
        totalFeePercentage: 100,
      },
      expectedCreatorPercentage: 80,
      expectedPlatformPercentage: 20,
      network: 'base',
    },
    {
      tokenAddress: '0x2345678901234567890123456789012345678901',
      tokenName: 'Test Token 2',
      tokenSymbol: 'TEST2',
      creatorAddress: '0xbcdef12345678901234567890123456789012345',
      creatorFid: '23456',
      deploymentDate: '2024-01-16T14:00:00Z',
      transactionHash: '0xdef1234567890123456789012345678901234567890123456789012345678902',
      feeConfiguration: {
        creatorFeePercentage: 75,
        platformFeePercentage: 25,
        totalFeePercentage: 100,
      },
      expectedCreatorPercentage: 75,
      expectedPlatformPercentage: 25,
      network: 'base-sepolia',
    },
  ];

  const mockOnChainRewards: Record<string, rewardsMonitor.OnChainRewards> = {
    '0x1234567890123456789012345678901234567890': {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      totalFeesCollected: BigInt('1000000000000000000'), // 1 ETH
      creatorFeesReceived: BigInt('800000000000000000'), // 0.8 ETH
      platformFeesReceived: BigInt('200000000000000000'), // 0.2 ETH
      creatorPercentage: 80,
      platformPercentage: 20,
      lastUpdated: '2024-01-20T10:00:00Z',
    },
    '0x2345678901234567890123456789012345678901': {
      tokenAddress: '0x2345678901234567890123456789012345678901',
      totalFeesCollected: BigInt('2000000000000000000'), // 2 ETH
      creatorFeesReceived: BigInt('1400000000000000000'), // 1.4 ETH (70% - discrepancy!)
      platformFeesReceived: BigInt('600000000000000000'), // 0.6 ETH
      creatorPercentage: 70,
      platformPercentage: 30,
      lastUpdated: '2024-01-20T10:00:00Z',
    },
  };

  const mockDiscrepancy: rewardsMonitor.RewardDiscrepancy = {
    tokenAddress: '0x2345678901234567890123456789012345678901',
    tokenName: 'Test Token 2',
    expectedCreatorPercentage: 75,
    actualCreatorPercentage: 70,
    percentageDifference: 5,
    expectedCreatorFees: BigInt('1500000000000000000'),
    actualCreatorFees: BigInt('1400000000000000000'),
    feeDifference: BigInt('100000000000000000'),
    severity: 'medium',
  };

  describe('generateWeeklyReport', () => {
    it('should generate a comprehensive weekly report', async () => {
      const endDate = new Date('2024-01-20T23:59:59Z');
      
      (rewardsMonitor.fetchDeploymentData as jest.Mock).mockResolvedValue(mockDeploymentData);
      (rewardsMonitor.verifyOnChainRewards as jest.Mock)
        .mockResolvedValueOnce(mockOnChainRewards['0x1234567890123456789012345678901234567890'])
        .mockResolvedValueOnce(mockOnChainRewards['0x2345678901234567890123456789012345678901']);
      (rewardsMonitor.detectDiscrepancies as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDiscrepancy);
      
      mockRedisClient.get.mockResolvedValue(null); // No previous report
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      const report = await generateWeeklyReport(endDate);

      expect(report).toMatchObject({
        id: 'weekly-report-2024-01-20',
        period: {
          startDate: expect.stringContaining('2024-01-13'),
          endDate: expect.stringContaining('2024-01-20'),
        },
        executiveSummary: {
          totalDeployments: 2,
          totalRevenue: '3.000000',
          creatorRevenue: '2.200000',
          platformRevenue: '0.800000',
          averageCreatorShare: 77.5,
          discrepancyRate: 50,
          healthScore: expect.any(Number),
        },
        deploymentStatistics: {
          totalCount: 2,
          averagePerDay: expect.closeTo(0.286, 2),
          peakDay: {
            date: '2024-01-15',
            count: 1,
          },
          byNetwork: {
            base: 1,
            'base-sepolia': 1,
          },
          uniqueCreators: 2,
        },
        revenueBreakdown: {
          totalCollected: '3.000000',
          creatorFees: {
            amount: '2.200000',
            percentage: 73,
          },
          platformFees: {
            amount: '0.800000',
            percentage: 26,
          },
          averageFeePerDeployment: '1.500000',
          topTokensByRevenue: expect.arrayContaining([
            {
              tokenAddress: '0x2345678901234567890123456789012345678901',
              tokenName: 'Test Token 2',
              revenue: '2.000000',
            },
          ]),
        },
        discrepancyAnalysis: {
          totalDiscrepancies: 1,
          severityBreakdown: {
            high: 0,
            medium: 1,
            low: 0,
          },
          totalValueAtRisk: '0.100000',
          topDiscrepancies: [mockDiscrepancy],
          recommendations: expect.any(Array),
        },
        trends: {
          deploymentTrend: 'stable',
          revenueTrend: 'stable',
          discrepancyTrend: 'stable',
        },
        recommendations: expect.any(Array),
      });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'weekly-report-2024-01-20',
        expect.objectContaining({ id: 'weekly-report-2024-01-20' })
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith('weekly-report-2024-01-20', 7776000);
    });

    it('should handle empty deployment data', async () => {
      (rewardsMonitor.fetchDeploymentData as jest.Mock).mockResolvedValue([]);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      const report = await generateWeeklyReport();

      expect(report.executiveSummary).toMatchObject({
        totalDeployments: 0,
        totalRevenue: '0.000000',
        creatorRevenue: '0.000000',
        platformRevenue: '0.000000',
        averageCreatorShare: 80,
        discrepancyRate: 0,
      });

      expect(report.recommendations).toContain(
        'No deployments recorded this week. Check system connectivity and API health.'
      );
    });

    it('should analyze trends when previous report exists', async () => {
      const previousReport = {
        id: 'weekly-report-2024-01-13',
        rawData: {
          totalDeployments: 5,
          deploymentsWithDiscrepancies: 1,
          totalFeesCollected: BigInt('5000000000000000000'),
          totalCreatorFees: BigInt('4000000000000000000'),
          totalPlatformFees: BigInt('1000000000000000000'),
          averageCreatorPercentage: 80,
          discrepancies: [],
          deploymentsByDay: {},
          feesByDay: {},
        },
      };

      (rewardsMonitor.fetchDeploymentData as jest.Mock).mockResolvedValue(mockDeploymentData);
      (rewardsMonitor.verifyOnChainRewards as jest.Mock)
        .mockResolvedValueOnce(mockOnChainRewards['0x1234567890123456789012345678901234567890'])
        .mockResolvedValueOnce(mockOnChainRewards['0x2345678901234567890123456789012345678901']);
      (rewardsMonitor.detectDiscrepancies as jest.Mock)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDiscrepancy);
      
      mockRedisClient.get
        .mockResolvedValueOnce(previousReport) // Previous report
        .mockResolvedValueOnce(null); // Index
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      const report = await generateWeeklyReport();

      expect(report.trends).toEqual({
        deploymentTrend: 'decreasing',
        revenueTrend: 'decreasing',
        discrepancyTrend: 'worsening',
      });
    });

    it('should generate appropriate recommendations', async () => {
      // Create a scenario with high severity discrepancies
      const highSeverityDiscrepancy = { ...mockDiscrepancy, severity: 'high' as const };
      
      (rewardsMonitor.fetchDeploymentData as jest.Mock).mockResolvedValue(mockDeploymentData);
      (rewardsMonitor.verifyOnChainRewards as jest.Mock)
        .mockResolvedValue(mockOnChainRewards['0x1234567890123456789012345678901234567890']);
      (rewardsMonitor.detectDiscrepancies as jest.Mock)
        .mockReturnValue(highSeverityDiscrepancy);
      
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue(undefined);
      mockRedisClient.expire.mockResolvedValue(undefined);

      const report = await generateWeeklyReport();

      expect(report.recommendations).toContain(
        '2 high-severity discrepancies found. Investigate token contracts immediately.'
      );
      expect(report.recommendations).toContain(
        'High discrepancy rate detected. Review fee distribution configuration.'
      );
    });
  });

  describe('getReportHistory', () => {
    it('should retrieve report history', async () => {
      const mockReports = [
        { id: 'weekly-report-2024-01-20', generatedAt: '2024-01-21T00:00:00Z' },
        { id: 'weekly-report-2024-01-13', generatedAt: '2024-01-14T00:00:00Z' },
      ];

      mockRedisClient.get
        .mockResolvedValueOnce(['weekly-report-2024-01-13', 'weekly-report-2024-01-20']) // Index
        .mockResolvedValueOnce(mockReports[0]) // First report
        .mockResolvedValueOnce(mockReports[1]); // Second report

      const history = await getReportHistory(2);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('weekly-report-2024-01-20');
      expect(history[1].id).toBe('weekly-report-2024-01-13');
    });

    it('should handle missing reports gracefully', async () => {
      mockRedisClient.get
        .mockResolvedValueOnce(['weekly-report-2024-01-20', 'weekly-report-2024-01-13'])
        .mockResolvedValueOnce(null) // Missing report
        .mockResolvedValueOnce({ id: 'weekly-report-2024-01-13' });

      const history = await getReportHistory();

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('weekly-report-2024-01-13');
    });

    it('should return empty array when no reports exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const history = await getReportHistory();

      expect(history).toEqual([]);
    });
  });

  describe('generateMarkdownReport', () => {
    it('should generate a well-formatted markdown report', () => {
      const mockReport = {
        id: 'weekly-report-2024-01-20',
        generatedAt: '2024-01-21T00:00:00Z',
        period: {
          startDate: '2024-01-14T00:00:00Z',
          endDate: '2024-01-20T23:59:59Z',
        },
        executiveSummary: {
          totalDeployments: 10,
          totalRevenue: '15.500000',
          creatorRevenue: '12.400000',
          platformRevenue: '3.100000',
          averageCreatorShare: 80,
          discrepancyRate: 10,
          healthScore: 85,
        },
        deploymentStatistics: {
          totalCount: 10,
          averagePerDay: 1.43,
          peakDay: {
            date: '2024-01-17',
            count: 3,
          },
          byNetwork: {
            base: 7,
            'base-sepolia': 3,
          },
          uniqueCreators: 8,
        },
        revenueBreakdown: {
          totalCollected: '15.500000',
          creatorFees: {
            amount: '12.400000',
            percentage: 80,
          },
          platformFees: {
            amount: '3.100000',
            percentage: 20,
          },
          averageFeePerDeployment: '1.550000',
          topTokensByRevenue: [
            {
              tokenAddress: '0x123...',
              tokenName: 'Top Token',
              revenue: '5.000000',
            },
          ],
        },
        discrepancyAnalysis: {
          totalDiscrepancies: 1,
          severityBreakdown: {
            high: 0,
            medium: 1,
            low: 0,
          },
          totalValueAtRisk: '0.100000',
          topDiscrepancies: [mockDiscrepancy],
          recommendations: ['Review smart contract fee distribution logic'],
        },
        trends: {
          deploymentTrend: 'increasing' as const,
          revenueTrend: 'stable' as const,
          discrepancyTrend: 'improving' as const,
        },
        recommendations: ['Continue monitoring deployment growth'],
        rawData: {} as rewardsMonitor.WeeklyReportData,
      };

      const markdown = generateMarkdownReport(mockReport);

      expect(markdown).toContain('# Weekly Report - 2024-01-14 to 2024-01-20');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('**Health Score**: 85/100');
      expect(markdown).toContain('**Total Deployments**: 10');
      expect(markdown).toContain('## Deployment Statistics');
      expect(markdown).toContain('**Peak Day**: 2024-01-17 (3 deployments)');
      expect(markdown).toContain('## Revenue Breakdown');
      expect(markdown).toContain('### Top Tokens by Revenue');
      expect(markdown).toContain('## Discrepancy Analysis');
      expect(markdown).toContain('## Trends');
      expect(markdown).toContain('**Deployment Trend**: increasing');
      expect(markdown).toContain('## Recommendations');
      expect(markdown).toContain('Continue monitoring deployment growth');
    });

    it('should handle reports with no discrepancies', () => {
      const mockReport = {
        id: 'weekly-report-2024-01-20',
        generatedAt: '2024-01-21T00:00:00Z',
        period: {
          startDate: '2024-01-14T00:00:00Z',
          endDate: '2024-01-20T23:59:59Z',
        },
        executiveSummary: {
          totalDeployments: 5,
          totalRevenue: '10.000000',
          creatorRevenue: '8.000000',
          platformRevenue: '2.000000',
          averageCreatorShare: 80,
          discrepancyRate: 0,
          healthScore: 100,
        },
        deploymentStatistics: {
          totalCount: 5,
          averagePerDay: 0.71,
          peakDay: {
            date: '2024-01-17',
            count: 2,
          },
          byNetwork: {
            base: 5,
            'base-sepolia': 0,
          },
          uniqueCreators: 5,
        },
        revenueBreakdown: {
          totalCollected: '10.000000',
          creatorFees: {
            amount: '8.000000',
            percentage: 80,
          },
          platformFees: {
            amount: '2.000000',
            percentage: 20,
          },
          averageFeePerDeployment: '2.000000',
          topTokensByRevenue: [],
        },
        discrepancyAnalysis: {
          totalDiscrepancies: 0,
          severityBreakdown: {
            high: 0,
            medium: 0,
            low: 0,
          },
          totalValueAtRisk: '0.000000',
          topDiscrepancies: [],
          recommendations: [],
        },
        trends: {
          deploymentTrend: 'stable' as const,
          revenueTrend: 'stable' as const,
          discrepancyTrend: 'stable' as const,
        },
        recommendations: [],
        rawData: {} as rewardsMonitor.WeeklyReportData,
      };

      const markdown = generateMarkdownReport(mockReport);

      expect(markdown).toContain('**Health Score**: 100/100');
      expect(markdown).toContain('**Total Discrepancies**: 0');
      expect(markdown).not.toContain('### Top Discrepancies');
      expect(markdown).not.toContain('## Recommendations');
    });
  });
});