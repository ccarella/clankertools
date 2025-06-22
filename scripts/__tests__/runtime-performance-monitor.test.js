const {
  monitorRuntimePerformance,
  profileUserFlow,
  analyzeMemoryUsage,
  measureFrameRate,
  generateRuntimeReport
} = require('../runtime-performance-monitor');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

jest.mock('puppeteer');
jest.mock('fs').promises;

describe('Runtime Performance Monitor', () => {
  let mockBrowser;
  let mockPage;

  beforeEach(() => {
    mockPage = {
      goto: jest.fn().mockResolvedValue(),
      evaluate: jest.fn(),
      metrics: jest.fn().mockResolvedValue({
        JSHeapUsedSize: 10000000,
        JSHeapTotalSize: 20000000,
        Timestamp: Date.now()
      }),
      tracing: {
        start: jest.fn().mockResolvedValue(),
        stop: jest.fn().mockResolvedValue()
      },
      on: jest.fn(),
      close: jest.fn().mockResolvedValue()
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue()
    };

    puppeteer.launch.mockResolvedValue(mockBrowser);
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('monitorRuntimePerformance', () => {
    it('should monitor runtime metrics successfully', async () => {
      mockPage.evaluate.mockResolvedValue({
        renderTime: 150,
        scriptingTime: 200,
        layoutTime: 50,
        paintTime: 75,
        idleTime: 25
      });

      const results = await monitorRuntimePerformance('http://localhost:3000');

      expect(results).toMatchObject({
        url: 'http://localhost:3000',
        metrics: {
          renderTime: 150,
          scriptingTime: 200,
          totalBlockingTime: expect.any(Number)
        },
        timestamp: expect.any(String)
      });

      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    });

    it('should handle page errors gracefully', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const results = await monitorRuntimePerformance('http://localhost:3000');

      expect(results).toMatchObject({
        error: 'Navigation failed',
        url: 'http://localhost:3000'
      });
    });

    it('should capture performance observer data', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce({ /* initial metrics */ })
        .mockResolvedValueOnce([
          { name: 'LCP', value: 2500 },
          { name: 'FID', value: 100 },
          { name: 'CLS', value: 0.1 }
        ]);

      const results = await monitorRuntimePerformance('http://localhost:3000', {
        captureWebVitals: true
      });

      expect(results.webVitals).toMatchObject({
        LCP: 2500,
        FID: 100,
        CLS: 0.1
      });
    });
  });

  describe('profileUserFlow', () => {
    it('should profile token creation flow', async () => {
      const mockFlowMetrics = {
        steps: [
          { name: 'navigate', duration: 500 },
          { name: 'fillForm', duration: 200 },
          { name: 'uploadImage', duration: 1000 },
          { name: 'submit', duration: 300 },
          { name: 'waitForConfirmation', duration: 2000 }
        ],
        totalDuration: 4000,
        memoryDelta: 5000000
      };

      mockPage.evaluate.mockImplementation((fn) => {
        if (fn.toString().includes('performance.measure')) {
          return mockFlowMetrics;
        }
        return {};
      });

      const results = await profileUserFlow('token-creation');

      expect(results).toMatchObject({
        flow: 'token-creation',
        totalDuration: 4000,
        steps: expect.arrayContaining([
          expect.objectContaining({ name: 'navigate' })
        ])
      });

      expect(mockPage.tracing.start).toHaveBeenCalledWith({
        path: expect.stringContaining('trace-token-creation')
      });
    });

    it('should profile wallet connection flow', async () => {
      const results = await profileUserFlow('wallet-connection', {
        steps: [
          { action: 'click', selector: '.connect-wallet' },
          { action: 'wait', selector: '.wallet-modal' },
          { action: 'click', selector: '.wallet-provider' },
          { action: 'wait', selector: '.success-message' }
        ]
      });

      expect(mockPage.evaluate).toHaveBeenCalledTimes(4);
    });

    it('should handle flow errors and retry', async () => {
      mockPage.evaluate
        .mockRejectedValueOnce(new Error('Element not found'))
        .mockResolvedValueOnce({ totalDuration: 3000 });

      const results = await profileUserFlow('error-flow', {
        retries: 1
      });

      expect(results.retries).toBe(1);
      expect(results.totalDuration).toBe(3000);
    });
  });

  describe('analyzeMemoryUsage', () => {
    it('should detect memory leaks', async () => {
      const memorySnapshots = [
        { JSHeapUsedSize: 10000000, timestamp: 1000 },
        { JSHeapUsedSize: 15000000, timestamp: 2000 },
        { JSHeapUsedSize: 20000000, timestamp: 3000 },
        { JSHeapUsedSize: 25000000, timestamp: 4000 }
      ];

      mockPage.metrics.mockImplementation(() => 
        Promise.resolve(memorySnapshots.shift())
      );

      const analysis = await analyzeMemoryUsage(mockPage, {
        duration: 4000,
        interval: 1000
      });

      expect(analysis).toMatchObject({
        initialMemory: 10000000,
        finalMemory: 25000000,
        growth: 15000000,
        growthRate: expect.any(Number),
        possibleLeak: true
      });
    });

    it('should identify normal memory usage', async () => {
      mockPage.metrics.mockResolvedValue({
        JSHeapUsedSize: 10000000,
        JSHeapTotalSize: 20000000
      });

      const analysis = await analyzeMemoryUsage(mockPage, {
        duration: 2000,
        interval: 500
      });

      expect(analysis.possibleLeak).toBe(false);
    });

    it('should capture heap snapshots for detailed analysis', async () => {
      mockPage.evaluate.mockResolvedValue({
        heapSnapshot: 'mock-snapshot-data',
        objects: [
          { type: 'Array', count: 100, size: 50000 },
          { type: 'Object', count: 200, size: 100000 }
        ]
      });

      const analysis = await analyzeMemoryUsage(mockPage, {
        captureSnapshots: true
      });

      expect(analysis.heapAnalysis).toBeDefined();
      expect(analysis.heapAnalysis.objects).toHaveLength(2);
    });
  });

  describe('measureFrameRate', () => {
    it('should measure frame rate during scrolling', async () => {
      mockPage.evaluate.mockResolvedValue({
        fps: 58.5,
        frames: 585,
        duration: 10000,
        droppedFrames: 15
      });

      const results = await measureFrameRate(mockPage, 'scroll');

      expect(results).toMatchObject({
        action: 'scroll',
        averageFps: 58.5,
        droppedFrames: 15,
        performance: 'good'
      });
    });

    it('should detect janky animations', async () => {
      mockPage.evaluate.mockResolvedValue({
        fps: 25,
        frames: 250,
        duration: 10000,
        droppedFrames: 350
      });

      const results = await measureFrameRate(mockPage, 'animation');

      expect(results.performance).toBe('poor');
      expect(results.recommendations).toContain('animation');
    });

    it('should measure frame rate for specific interactions', async () => {
      const interactions = ['scroll', 'toggle', 'transition'];
      const results = [];

      for (const interaction of interactions) {
        mockPage.evaluate.mockResolvedValueOnce({
          fps: 60,
          frames: 600,
          duration: 10000
        });

        const result = await measureFrameRate(mockPage, interaction);
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results.every(r => r.averageFps === 60)).toBe(true);
    });
  });

  describe('generateRuntimeReport', () => {
    it('should generate comprehensive runtime report', async () => {
      const mockData = {
        runtime: {
          renderTime: 150,
          scriptingTime: 200,
          totalBlockingTime: 250
        },
        memory: {
          initialMemory: 10000000,
          finalMemory: 12000000,
          possibleLeak: false
        },
        frameRate: {
          averageFps: 59,
          performance: 'good'
        },
        userFlows: [
          { flow: 'token-creation', totalDuration: 3000 }
        ],
        timestamp: new Date().toISOString()
      };

      const reportPath = await generateRuntimeReport(mockData);

      expect(reportPath).toMatch(/reports\/runtime-performance-\d{8}-\d{6}\.html$/);
      expect(fs.writeFile).toHaveBeenCalled();

      const [_, content] = fs.writeFile.mock.calls[0];
      expect(content).toContain('Runtime Performance Report');
      expect(content).toContain('Total Blocking Time: 250ms');
      expect(content).toContain('Average FPS: 59');
    });

    it('should highlight performance issues in report', async () => {
      const mockData = {
        runtime: { totalBlockingTime: 800 },
        memory: { possibleLeak: true },
        frameRate: { averageFps: 30, performance: 'poor' }
      };

      await generateRuntimeReport(mockData);

      const [_, content] = fs.writeFile.mock.calls[0];
      expect(content).toContain('class="warning"');
      expect(content).toContain('Possible memory leak detected');
      expect(content).toContain('Poor frame rate');
    });
  });

  describe('Mobile performance monitoring', () => {
    it('should emulate mobile device', async () => {
      await monitorRuntimePerformance('http://localhost:3000', {
        device: 'Mobile'
      });

      expect(mockPage.emulate).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: expect.objectContaining({
            width: 375,
            height: 667,
            isMobile: true
          })
        })
      );
    });

    it('should measure touch responsiveness', async () => {
      mockPage.evaluate.mockResolvedValue({
        touchDelay: 50,
        touchEvents: 100,
        averageDelay: 45
      });

      const results = await monitorRuntimePerformance('http://localhost:3000', {
        device: 'Mobile',
        measureTouch: true
      });

      expect(results.touch).toMatchObject({
        averageDelay: 45,
        performance: 'excellent'
      });
    });
  });

  describe('CLI interface', () => {
    it('should parse flow monitoring arguments', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'runtime-monitor.js', '--flow', 'token-creation'];

      const { mode, flow } = require('../runtime-performance-monitor').parseArgs();

      expect(mode).toBe('flow');
      expect(flow).toBe('token-creation');

      process.argv = originalArgv;
    });

    it('should validate flow names', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'runtime-monitor.js', '--flow', 'invalid-flow'];

      expect(() => {
        require('../runtime-performance-monitor').parseArgs();
      }).toThrow('Invalid flow name');

      process.argv = originalArgv;
    });
  });
});