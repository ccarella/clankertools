import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import * as reportGenerator from '@/lib/monitoring/report-generator';
import { getRedisClient } from '@/lib/redis';

jest.mock('@/lib/redis');
jest.mock('@/lib/monitoring/report-generator');

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  expire: jest.fn(),
};

(getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

describe('/api/monitoring/reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockReport: reportGenerator.WeeklyReport = {
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
      peakDay: { date: '2024-01-17', count: 3 },
      byNetwork: { base: 7, 'base-sepolia': 3 },
      uniqueCreators: 8,
    },
    revenueBreakdown: {
      totalCollected: '15.500000',
      creatorFees: { amount: '12.400000', percentage: 80 },
      platformFees: { amount: '3.100000', percentage: 20 },
      averageFeePerDeployment: '1.550000',
      topTokensByRevenue: [],
    },
    discrepancyAnalysis: {
      totalDiscrepancies: 1,
      severityBreakdown: { high: 0, medium: 1, low: 0 },
      totalValueAtRisk: '0.100000',
      topDiscrepancies: [],
      recommendations: [],
    },
    trends: {
      deploymentTrend: 'stable',
      revenueTrend: 'stable',
      discrepancyTrend: 'stable',
    },
    recommendations: [],
    rawData: {
      startDate: '2024-01-14T00:00:00Z',
      endDate: '2024-01-20T23:59:59Z',
      totalDeployments: 10,
      deploymentsWithDiscrepancies: 1,
      totalFeesCollected: BigInt('15500000000000000000'),
      totalCreatorFees: BigInt('12400000000000000000'),
      totalPlatformFees: BigInt('3100000000000000000'),
      averageCreatorPercentage: 80,
      discrepancies: [],
      deploymentsByDay: {},
      feesByDay: {},
    },
  };

  describe('GET', () => {
    it('should return latest report by default', async () => {
      (reportGenerator.getReportHistory as jest.Mock).mockResolvedValue([mockReport]);

      const request = new NextRequest('http://localhost:3000/api/monitoring/reports');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockReport);
      expect(reportGenerator.getReportHistory).toHaveBeenCalledWith(1);
    });

    it('should generate new report if none exist', async () => {
      (reportGenerator.getReportHistory as jest.Mock).mockResolvedValue([]);
      (reportGenerator.generateWeeklyReport as jest.Mock).mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost:3000/api/monitoring/reports');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockReport);
      expect(reportGenerator.generateWeeklyReport).toHaveBeenCalledWith();
    });

    it('should generate report with specific end date', async () => {
      (reportGenerator.generateWeeklyReport as jest.Mock).mockResolvedValue(mockReport);

      const request = new NextRequest(
        'http://localhost:3000/api/monitoring/reports?action=generate&endDate=2024-01-20'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockReport);
      expect(reportGenerator.generateWeeklyReport).toHaveBeenCalledWith(
        expect.objectContaining({ toISOString: expect.any(Function) })
      );
    });

    it('should return report history', async () => {
      const mockReports = [mockReport, { ...mockReport, id: 'weekly-report-2024-01-13' }];
      (reportGenerator.getReportHistory as jest.Mock).mockResolvedValue(mockReports);

      const request = new NextRequest(
        'http://localhost:3000/api/monitoring/reports?action=history&limit=2'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        reports: mockReports,
        count: 2,
      });
      expect(reportGenerator.getReportHistory).toHaveBeenCalledWith(2);
    });

    it('should return markdown format', async () => {
      (reportGenerator.getReportHistory as jest.Mock).mockResolvedValue([mockReport]);
      (reportGenerator.generateMarkdownReport as jest.Mock).mockReturnValue('# Weekly Report\n...');

      const request = new NextRequest(
        'http://localhost:3000/api/monitoring/reports?format=markdown'
      );
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/markdown');
      expect(text).toBe('# Weekly Report\n...');
      expect(reportGenerator.generateMarkdownReport).toHaveBeenCalledWith(mockReport);
    });

    it('should handle invalid query parameters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/monitoring/reports?action=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('details');
    });

    it('should handle errors gracefully', async () => {
      (reportGenerator.getReportHistory as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/monitoring/reports');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to process report request' });
    });
  });

  describe('POST', () => {
    it('should generate a new report', async () => {
      (reportGenerator.generateWeeklyReport as jest.Mock).mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost:3000/api/monitoring/reports', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        report: mockReport,
        message: expect.stringContaining('Weekly report generated'),
      });
      expect(reportGenerator.generateWeeklyReport).toHaveBeenCalled();
    });

    it('should generate report with specific end date', async () => {
      (reportGenerator.generateWeeklyReport as jest.Mock).mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost:3000/api/monitoring/reports', {
        method: 'POST',
        body: JSON.stringify({ endDate: '2024-01-20' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(reportGenerator.generateWeeklyReport).toHaveBeenCalledWith(
        expect.objectContaining({ toISOString: expect.any(Function) })
      );
    });

    it('should handle invalid request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/reports', {
        method: 'POST',
        body: JSON.stringify({ endDate: 123 }), // Invalid type
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('details');
    });

    it('should handle generation errors', async () => {
      (reportGenerator.generateWeeklyReport as jest.Mock).mockRejectedValue(
        new Error('Generation failed')
      );

      const request = new NextRequest('http://localhost:3000/api/monitoring/reports', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to generate report' });
    });
  });
});