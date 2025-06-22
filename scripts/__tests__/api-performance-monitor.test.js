const {
  monitorApiPerformance,
  analyzeEndpoints,
  checkQueryPerformance,
  generateApiReport
} = require('../api-performance-monitor');
const fetch = require('node-fetch');
const fs = require('fs').promises;

jest.mock('node-fetch');
jest.mock('fs').promises;

describe('API Performance Monitor', () => {
  const mockApiResponse = {
    ok: true,
    status: 200,
    json: async () => ({ success: true })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1250); // 250ms response time
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('monitorApiPerformance', () => {
    it('should measure API endpoint response times', async () => {
      fetch.mockResolvedValue(mockApiResponse);

      const endpoints = [
        '/api/deploy/simple',
        '/api/deploy/advanced',
        '/api/token/0x123'
      ];

      const results = await monitorApiPerformance(endpoints);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        endpoint: '/api/deploy/simple',
        responseTime: expect.any(Number),
        status: 200,
        success: true
      });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle API errors gracefully', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const results = await monitorApiPerformance(['/api/failing']);

      expect(results[0]).toMatchObject({
        endpoint: '/api/failing',
        responseTime: expect.any(Number),
        status: 'error',
        success: false,
        error: 'Network error'
      });
    });

    it('should measure timeouts correctly', async () => {
      const slowResponse = new Promise(resolve => 
        setTimeout(() => resolve(mockApiResponse), 5000)
      );
      fetch.mockReturnValue(slowResponse);

      const results = await monitorApiPerformance(
        ['/api/slow'],
        { timeout: 1000 }
      );

      expect(results[0]).toMatchObject({
        endpoint: '/api/slow',
        status: 'timeout',
        success: false,
        responseTime: expect.any(Number)
      });
    });

    it('should include request headers in monitoring', async () => {
      fetch.mockResolvedValue(mockApiResponse);

      await monitorApiPerformance(['/api/auth'], {
        headers: { 'Authorization': 'Bearer token' }
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token'
          })
        })
      );
    });
  });

  describe('analyzeEndpoints', () => {
    const mockPerformanceData = [
      { endpoint: '/api/deploy/simple', responseTime: 200 },
      { endpoint: '/api/deploy/simple', responseTime: 250 },
      { endpoint: '/api/deploy/simple', responseTime: 300 },
      { endpoint: '/api/deploy/advanced', responseTime: 400 },
      { endpoint: '/api/deploy/advanced', responseTime: 450 },
      { endpoint: '/api/token/123', responseTime: 100 }
    ];

    it('should calculate statistics per endpoint', async () => {
      const analysis = await analyzeEndpoints(mockPerformanceData);

      expect(analysis['/api/deploy/simple']).toMatchObject({
        count: 3,
        average: 250,
        median: 250,
        p95: expect.any(Number),
        min: 200,
        max: 300
      });

      expect(analysis['/api/deploy/advanced']).toMatchObject({
        count: 2,
        average: 425,
        median: 425
      });
    });

    it('should identify slow endpoints', async () => {
      const analysis = await analyzeEndpoints(mockPerformanceData);
      const slowEndpoints = Object.entries(analysis)
        .filter(([_, stats]) => stats.p95 > 400)
        .map(([endpoint]) => endpoint);

      expect(slowEndpoints).toContain('/api/deploy/advanced');
    });

    it('should handle empty data', async () => {
      const analysis = await analyzeEndpoints([]);
      expect(analysis).toEqual({});
    });
  });

  describe('checkQueryPerformance', () => {
    it('should analyze database query performance', async () => {
      const mockQueries = [
        { query: 'SELECT * FROM tokens', duration: 50, count: 100 },
        { query: 'INSERT INTO wallets', duration: 150, count: 50 },
        { query: 'UPDATE tokens SET', duration: 200, count: 25 }
      ];

      const analysis = await checkQueryPerformance(mockQueries);

      expect(analysis).toMatchObject({
        totalQueries: 175,
        averageDuration: expect.any(Number),
        slowQueries: expect.arrayContaining([
          expect.objectContaining({
            query: 'UPDATE tokens SET',
            duration: 200
          })
        ])
      });
    });

    it('should identify N+1 query patterns', async () => {
      const mockQueries = [
        { query: 'SELECT * FROM users', duration: 10, count: 1 },
        { query: 'SELECT * FROM tokens WHERE user_id = ?', duration: 5, count: 100 }
      ];

      const analysis = await checkQueryPerformance(mockQueries);

      expect(analysis.warnings).toContain('Potential N+1 query pattern detected');
    });

    it('should recommend indexes for slow queries', async () => {
      const mockQueries = [
        { 
          query: 'SELECT * FROM tokens WHERE created_at > ?', 
          duration: 500, 
          count: 10,
          executionPlan: 'SCAN TABLE tokens'
        }
      ];

      const analysis = await checkQueryPerformance(mockQueries);

      expect(analysis.recommendations).toContain(
        expect.stringContaining('Consider adding index')
      );
    });
  });

  describe('generateApiReport', () => {
    it('should generate comprehensive API performance report', async () => {
      const mockData = {
        endpoints: {
          '/api/deploy/simple': {
            average: 250,
            p95: 350,
            count: 100,
            errors: 2
          }
        },
        queries: {
          totalQueries: 1000,
          averageDuration: 75,
          slowQueries: []
        },
        timestamp: new Date().toISOString()
      };

      const reportPath = await generateApiReport(mockData);

      expect(reportPath).toMatch(/reports\/api-performance-\d{8}-\d{6}\.html$/);
      expect(fs.writeFile).toHaveBeenCalled();

      const [_, content] = fs.writeFile.mock.calls[0];
      expect(content).toContain('API Performance Report');
      expect(content).toContain('250ms');
      expect(content).toContain('95th percentile: 350ms');
    });

    it('should include error analysis in report', async () => {
      const mockData = {
        endpoints: {
          '/api/failing': {
            average: 0,
            errors: 50,
            errorRate: 100
          }
        }
      };

      await generateApiReport(mockData);

      const [_, content] = fs.writeFile.mock.calls[0];
      expect(content).toContain('Error Rate: 100%');
      expect(content).toContain('class="error"');
    });
  });

  describe('Performance thresholds', () => {
    it('should classify response times correctly', () => {
      const { classifyResponseTime } = require('../api-performance-monitor');

      expect(classifyResponseTime(100)).toBe('excellent');
      expect(classifyResponseTime(300)).toBe('good');
      expect(classifyResponseTime(700)).toBe('acceptable');
      expect(classifyResponseTime(1200)).toBe('poor');
    });

    it('should calculate SLA compliance', () => {
      const { calculateSlaCompliance } = require('../api-performance-monitor');

      const data = [
        { responseTime: 400 },
        { responseTime: 600 },
        { responseTime: 800 },
        { responseTime: 1200 }
      ];

      const compliance = calculateSlaCompliance(data, 1000);
      expect(compliance).toBe(75); // 3 out of 4 under 1000ms
    });
  });

  describe('CLI interface', () => {
    it('should parse command line arguments', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'api-monitor.js', '--endpoints', '--period', '1h'];

      const { mode, period } = require('../api-performance-monitor').parseArgs();

      expect(mode).toBe('endpoints');
      expect(period).toBe('1h');
      
      process.argv = originalArgv;
    });

    it('should validate monitoring modes', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'api-monitor.js', '--invalid'];

      expect(() => {
        require('../api-performance-monitor').parseArgs();
      }).toThrow('Invalid monitoring mode');

      process.argv = originalArgv;
    });
  });

  describe('External API monitoring', () => {
    it('should monitor Clanker API performance', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => '250ms' }
      });

      const results = await monitorApiPerformance(
        ['https://api.clanker.com/tokens'],
        { external: true }
      );

      expect(results[0]).toMatchObject({
        endpoint: 'https://api.clanker.com/tokens',
        responseTime: expect.any(Number),
        serverTime: '250ms'
      });
    });

    it('should monitor IPFS gateway performance', async () => {
      const results = await monitorApiPerformance(
        ['https://ipfs.io/ipfs/QmTest'],
        { external: true }
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://ipfs.io/ipfs/QmTest',
        expect.any(Object)
      );
    });
  });
});