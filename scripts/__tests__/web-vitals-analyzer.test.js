const { analyzeWebVitals, generateVitalsReport } = require('../web-vitals-analyzer');
const fs = require('fs').promises;
const path = require('path');

jest.mock('fs').promises;

describe('Web Vitals Analyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeWebVitals', () => {
    it('should analyze web vitals data for specified period', async () => {
      const mockData = {
        lcp: [1200, 1500, 1800, 2000, 2200],
        fid: [50, 75, 100, 125, 150],
        cls: [0.05, 0.08, 0.1, 0.12, 0.15],
        fcp: [800, 1000, 1200, 1400, 1600],
        ttfb: [200, 300, 400, 500, 600]
      };

      const result = await analyzeWebVitals(mockData, '14d');

      expect(result).toMatchObject({
        period: '14d',
        metrics: {
          lcp: {
            median: 1800,
            p75: 2000,
            p95: expect.any(Number),
            average: expect.any(Number)
          },
          fid: {
            median: 100,
            p75: 125,
            p95: expect.any(Number),
            average: expect.any(Number)
          },
          cls: {
            median: 0.1,
            p75: 0.12,
            p95: expect.any(Number),
            average: expect.any(Number)
          }
        },
        score: expect.any(Number),
        status: expect.stringMatching(/good|needs-improvement|poor/)
      });
    });

    it('should handle empty data gracefully', async () => {
      const mockData = {
        lcp: [],
        fid: [],
        cls: [],
        fcp: [],
        ttfb: []
      };

      const result = await analyzeWebVitals(mockData, '7d');

      expect(result.metrics.lcp.median).toBe(0);
      expect(result.score).toBe(0);
      expect(result.status).toBe('poor');
    });

    it('should calculate performance score correctly', async () => {
      const goodData = {
        lcp: [1000, 1200, 1500], // Good LCP < 2500ms
        fid: [50, 60, 70], // Good FID < 100ms
        cls: [0.05, 0.06, 0.08] // Good CLS < 0.1
      };

      const result = await analyzeWebVitals(goodData, '7d');
      expect(result.score).toBeGreaterThan(90);
      expect(result.status).toBe('good');
    });

    it('should identify poor performance correctly', async () => {
      const poorData = {
        lcp: [4000, 4500, 5000], // Poor LCP > 4000ms
        fid: [300, 350, 400], // Poor FID > 300ms
        cls: [0.25, 0.3, 0.35] // Poor CLS > 0.25
      };

      const result = await analyzeWebVitals(poorData, '7d');
      expect(result.score).toBeLessThan(50);
      expect(result.status).toBe('poor');
    });
  });

  describe('generateVitalsReport', () => {
    it('should generate HTML report with correct data', async () => {
      const analysis = {
        period: '14d',
        metrics: {
          lcp: { median: 1800, p75: 2000, p95: 2200, average: 1900 },
          fid: { median: 100, p75: 125, p95: 150, average: 110 },
          cls: { median: 0.1, p75: 0.12, p95: 0.15, average: 0.11 }
        },
        score: 85,
        status: 'good',
        timestamp: new Date().toISOString()
      };

      const reportPath = await generateVitalsReport(analysis);

      expect(reportPath).toMatch(/reports\/web-vitals-\d{8}-\d{6}\.html$/);
      expect(fs.writeFile).toHaveBeenCalled();
      
      const [filePath, content] = fs.writeFile.mock.calls[0];
      expect(content).toContain('Core Web Vitals Report');
      expect(content).toContain('1800ms');
      expect(content).toContain('Score: 85');
    });

    it('should create reports directory if it does not exist', async () => {
      fs.access.mockRejectedValueOnce(new Error('ENOENT'));

      const analysis = {
        metrics: { lcp: {}, fid: {}, cls: {} },
        score: 50,
        status: 'needs-improvement'
      };

      await generateVitalsReport(analysis);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('reports'),
        { recursive: true }
      );
    });

    it('should handle report generation errors', async () => {
      fs.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      const analysis = {
        metrics: { lcp: {}, fid: {}, cls: {} },
        score: 50,
        status: 'poor'
      };

      await expect(generateVitalsReport(analysis)).rejects.toThrow('Write failed');
    });
  });

  describe('CLI interface', () => {
    it('should parse command line arguments correctly', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'web-vitals-analyzer.js', '--period', '7d'];

      const { period } = require('../web-vitals-analyzer').parseArgs();
      
      expect(period).toBe('7d');
      process.argv = originalArgv;
    });

    it('should use default period when not specified', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'web-vitals-analyzer.js'];

      const { period } = require('../web-vitals-analyzer').parseArgs();
      
      expect(period).toBe('14d');
      process.argv = originalArgv;
    });

    it('should validate period format', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'web-vitals-analyzer.js', '--period', 'invalid'];

      expect(() => {
        require('../web-vitals-analyzer').parseArgs();
      }).toThrow('Invalid period format');
      
      process.argv = originalArgv;
    });
  });

  describe('Data aggregation', () => {
    it('should calculate percentiles correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const { calculatePercentile } = require('../web-vitals-analyzer');

      expect(calculatePercentile(data, 50)).toBe(5.5);
      expect(calculatePercentile(data, 75)).toBe(7.75);
      expect(calculatePercentile(data, 95)).toBe(9.55);
    });

    it('should handle edge cases in percentile calculation', () => {
      const { calculatePercentile } = require('../web-vitals-analyzer');

      expect(calculatePercentile([5], 50)).toBe(5);
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([1, 2], 50)).toBe(1.5);
    });
  });

  describe('Threshold validation', () => {
    it('should classify metrics according to Web Vitals thresholds', () => {
      const { classifyMetric } = require('../web-vitals-analyzer');

      // LCP thresholds
      expect(classifyMetric('lcp', 2000)).toBe('good');
      expect(classifyMetric('lcp', 3000)).toBe('needs-improvement');
      expect(classifyMetric('lcp', 4500)).toBe('poor');

      // FID thresholds
      expect(classifyMetric('fid', 50)).toBe('good');
      expect(classifyMetric('fid', 150)).toBe('needs-improvement');
      expect(classifyMetric('fid', 350)).toBe('poor');

      // CLS thresholds
      expect(classifyMetric('cls', 0.05)).toBe('good');
      expect(classifyMetric('cls', 0.15)).toBe('needs-improvement');
      expect(classifyMetric('cls', 0.30)).toBe('poor');
    });
  });
});