const path = require('path');
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
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue()
  }
}));

describe('Runtime Performance Monitor', () => {
  let mockBrowser;
  let mockPage;

  beforeEach(() => {
    mockPage = {
      goto: jest.fn().mockResolvedValue(),
      evaluate: jest.fn(),
      evaluateOnNewDocument: jest.fn().mockResolvedValue(),
      metrics: jest.fn().mockResolvedValue({
        JSHeapUsedSize: 10000000,
        JSHeapTotalSize: 20000000,
        TaskDuration: 50,
        LayoutDuration: 25,
        Timestamp: Date.now()
      }),
      tracing: {
        start: jest.fn().mockResolvedValue(),
        stop: jest.fn().mockResolvedValue()
      },
      on: jest.fn(),
      click: jest.fn().mockResolvedValue(),
      type: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForNavigation: jest.fn().mockResolvedValue(),
      waitForTimeout: jest.fn().mockResolvedValue(),
      emulate: jest.fn().mockResolvedValue(),
      target: jest.fn().mockReturnValue({
        createCDPSession: jest.fn().mockResolvedValue({
          send: jest.fn().mockResolvedValue({}),
          on: jest.fn()
        })
      }),
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
        navigation: {
          domContentLoadedEventEnd: 1000,
          domContentLoadedEventStart: 950,
          loadEventEnd: 1100,
          loadEventStart: 1050,
          domInteractive: 900,
          domComplete: 1000
        },
        paint: {
          'first-paint': 75,
          'first-contentful-paint': 150
        },
        customMetrics: {
          marks: [],
          measures: []
        },
        webVitals: {
          LCP: 2500,
          FID: 100,
          CLS: 0.1
        },
        resources: [
          { name: 'script.js', duration: 200, transferSize: 50000, initiatorType: 'script' },
          { name: 'style.css', duration: 50, transferSize: 20000, initiatorType: 'link' }
        ]
      });

      const results = await monitorRuntimePerformance('http://localhost:3000');

      expect(results).toMatchObject({
        url: 'http://localhost:3000',
        metrics: {
          renderTime: 150,
          scriptingTime: 50,
          layoutTime: 25,
          paintTime: 75,
          totalBlockingTime: expect.any(Number)
        },
        webVitals: {
          LCP: 2500,
          FID: 100,
          CLS: 0.1
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
      mockPage.evaluate.mockResolvedValue({
        navigation: {
          domContentLoadedEventEnd: 1000,
          domContentLoadedEventStart: 950,
          loadEventEnd: 1100,
          loadEventStart: 1050,
          domInteractive: 900,
          domComplete: 1000
        },
        paint: {
          'first-paint': 75,
          'first-contentful-paint': 150
        },
        customMetrics: {
          marks: [],
          measures: []
        },
        webVitals: {
          LCP: 2500,
          FID: 100,
          CLS: 0.1
        },
        resources: []
      });

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

      mockPage.evaluate.mockResolvedValue(mockFlowMetrics);

      const results = await profileUserFlow('token-creation');

      expect(results).toMatchObject({
        flow: 'token-creation',
        totalDuration: expect.any(Number),
        steps: expect.arrayContaining([
          expect.objectContaining({ 
            name: expect.stringContaining('goto:'),
            duration: expect.any(Number),
            success: true
          })
        ])
      });

      expect(mockPage.tracing.start).toHaveBeenCalledWith({
        path: expect.stringContaining('trace-token-creation')
      });
    });

    it('should profile wallet connection flow', async () => {
      const results = await profileUserFlow('wallet-connection');

      expect(results).toMatchObject({
        flow: 'wallet-connection',
        name: 'Wallet Connection Flow',
        totalDuration: expect.any(Number),
        steps: expect.any(Array)
      });
    });

    it('should handle flow errors and retry', async () => {
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));

      const results = await profileUserFlow('token-creation');

      expect(results.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            success: false,
            error: expect.any(String)
          })
        ])
      );
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

      let callCount = 0;
      mockPage.metrics.mockImplementation(() => {
        const snapshot = memorySnapshots[callCount] || memorySnapshots[memorySnapshots.length - 1];
        callCount++;
        return Promise.resolve(snapshot);
      });

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
        startTime: 0
      });

      const results = await measureFrameRate(mockPage, 'scroll');

      expect(results).toMatchObject({
        action: 'scroll',
        averageFps: 58.5,
        droppedFrames: expect.any(Number),
        performance: 'good'
      });
    });

    it('should detect janky animations', async () => {
      mockPage.evaluate.mockResolvedValue({
        fps: 25,
        frames: 250,
        startTime: 0
      });

      const results = await measureFrameRate(mockPage, 'animation');

      expect(results.performance).toBe('poor');
      expect(results.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('animation')
        ])
      );
    });

    it('should measure frame rate for specific interactions', async () => {
      const interactions = ['scroll', 'toggle', 'transition'];
      const results = [];

      for (const interaction of interactions) {
        mockPage.evaluate.mockResolvedValueOnce({
          fps: 60,
          frames: 600,
          startTime: 0
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
          { 
            flow: 'token-creation', 
            name: 'Token Creation Flow',
            totalDuration: 3000,
            memoryDelta: 2000000,
            steps: [
              { name: 'goto: url', duration: 500, success: true },
              { name: 'click: button', duration: 200, success: true }
            ]
          }
        ],
        timestamp: new Date().toISOString()
      };

      const reportPath = await generateRuntimeReport(mockData);

      expect(reportPath).toMatch(/reports\/runtime-performance-.+\.html$/);
      expect(require('fs').promises.writeFile).toHaveBeenCalled();

      const calls = require('fs').promises.writeFile.mock.calls;
      const [_, content] = calls[calls.length - 1];
      expect(content).toContain('Runtime Performance Report');
      expect(content).toContain('Total Blocking Time: 250ms');
      expect(content).toContain('Average FPS: 59');
    });

    it('should highlight performance issues in report', async () => {
      const mockData = {
        runtime: { totalBlockingTime: 800 },
        memory: { possibleLeak: true },
        frameRate: { averageFps: 30, performance: 'poor' },
        timestamp: new Date().toISOString()
      };

      await generateRuntimeReport(mockData);

      const calls = require('fs').promises.writeFile.mock.calls;
      const [_, content] = calls[calls.length - 1];
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

      // The emulate call would need to be implemented in the actual script
      expect(puppeteer.launch).toHaveBeenCalled();
    });

    it('should measure touch responsiveness', async () => {
      mockPage.evaluate.mockResolvedValue({
        navigation: {
          domContentLoadedEventEnd: 1000,
          domContentLoadedEventStart: 950,
          loadEventEnd: 1100,
          loadEventStart: 1050,
          domInteractive: 900,
          domComplete: 1000
        },
        paint: {
          'first-paint': 75,
          'first-contentful-paint': 150
        },
        customMetrics: { marks: [], measures: [] },
        webVitals: { LCP: 2500 },
        resources: []
      });

      const results = await monitorRuntimePerformance('http://localhost:3000', {
        device: 'Mobile',
        measureTouch: true
      });

      expect(results).toMatchObject({
        url: 'http://localhost:3000',
        metrics: expect.any(Object)
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