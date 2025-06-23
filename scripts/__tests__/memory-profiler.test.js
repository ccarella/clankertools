const {
  profileMemoryUsage,
  detectMemoryLeaks,
  analyzeHeapSnapshot,
  generateMemoryReport
} = require('../memory-profiler');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const v8 = require('v8');

jest.mock('puppeteer');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue()
  }
}));
jest.mock('v8');

describe('Memory Profiler', () => {
  let mockBrowser;
  let mockPage;
  let mockCDPSession;

  beforeEach(() => {
    mockCDPSession = {
      send: jest.fn(),
      on: jest.fn()
    };

    mockPage = {
      goto: jest.fn().mockResolvedValue(),
      evaluate: jest.fn(),
      evaluateOnNewDocument: jest.fn().mockResolvedValue(),
      metrics: jest.fn().mockResolvedValue({
        JSHeapUsedSize: 10000000,
        JSHeapTotalSize: 20000000,
        Timestamp: Date.now()
      }),
      target: jest.fn().mockReturnValue({
        createCDPSession: jest.fn().mockResolvedValue(mockCDPSession)
      }),
      click: jest.fn().mockResolvedValue(),
      type: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      waitForNavigation: jest.fn().mockResolvedValue(),
      waitForTimeout: jest.fn().mockResolvedValue(),
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

  describe('profileMemoryUsage', () => {
    it('should profile memory usage over time', async () => {
      const memorySnapshots = [
        { JSHeapUsedSize: 10000000, timestamp: 1000 },
        { JSHeapUsedSize: 11000000, timestamp: 2000 },
        { JSHeapUsedSize: 12000000, timestamp: 3000 }
      ];

      let snapshotIndex = 0;
      let currentTime = 0;
      
      // Mock Date.now to simulate time progression
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => {
        const time = currentTime;
        currentTime += 1000; // Advance 1 second each call
        return time;
      });
      
      // Mock waitForTimeout to advance time
      mockPage.waitForTimeout.mockImplementation(() => {
        currentTime += 1000;
        return Promise.resolve();
      });
      
      mockPage.metrics.mockImplementation(() => {
        const snapshot = memorySnapshots[snapshotIndex] || memorySnapshots[memorySnapshots.length - 1];
        snapshotIndex++;
        return Promise.resolve(snapshot);
      });

      const profile = await profileMemoryUsage('http://localhost:3000', {
        duration: 3000,
        interval: 1000
      });
      
      // Restore Date.now
      Date.now = originalDateNow;

      expect(profile).toMatchObject({
        url: 'http://localhost:3000',
        samples: expect.arrayContaining([
          expect.objectContaining({ heapUsed: 10000000 }),
          expect.objectContaining({ heapUsed: 11000000 }),
          expect.objectContaining({ heapUsed: 12000000 })
        ]),
        summary: {
          initialHeap: 10000000,
          finalHeap: 12000000,
          peakHeap: 12000000,
          averageHeap: 11000000
        }
      });
    });

    it('should capture garbage collection events', async () => {
      // Mock Date.now to prevent infinite loop
      let currentTime = 0;
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => {
        const time = currentTime;
        currentTime += 5000; // Skip to end quickly
        return time;
      });
      
      mockPage.evaluate.mockResolvedValue({
        gcEvents: [
          { type: 'minor', duration: 5, freed: 500000 },
          { type: 'major', duration: 50, freed: 2000000 }
        ]
      });

      const profile = await profileMemoryUsage('http://localhost:3000', {
        captureGC: true
      });
      
      Date.now = originalDateNow;

      expect(profile.gcActivity).toMatchObject({
        minorGCs: 1,
        majorGCs: 1,
        totalGCTime: 55,
        memoryFreed: 2500000
      });
    });

    it('should identify memory allocation patterns', async () => {
      // Mock Date.now to prevent infinite loop
      let currentTime = 0;
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => {
        const time = currentTime;
        currentTime += 5000; // Skip to end quickly
        return time;
      });
      
      mockPage.evaluate.mockResolvedValue({
        allocations: [
          { type: 'Array', size: 1000000, count: 50 },
          { type: 'Object', size: 500000, count: 100 },
          { type: 'String', size: 2000000, count: 1000 }
        ]
      });

      const profile = await profileMemoryUsage('http://localhost:3000', {
        trackAllocations: true
      });
      
      Date.now = originalDateNow;

      expect(profile.topAllocations).toContainEqual(
        expect.objectContaining({
          type: 'String',
          totalSize: 2000000
        })
      );
    });
  });

  describe('detectMemoryLeaks', () => {
    it('should detect memory leaks through growth patterns', async () => {
      const growingMemory = Array.from({ length: 10 }, (_, i) => ({
        JSHeapUsedSize: 10000000 + (i * 1000000),
        timestamp: 1000 + (i * 1000)
      }));

      // Mock Date.now to prevent infinite loop
      let currentTime = 0;
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => {
        const time = currentTime;
        currentTime += 2000; // Advance quickly
        return time;
      });

      let index = 0;
      mockPage.metrics.mockImplementation(() => {
        const snapshot = growingMemory[index] || growingMemory[growingMemory.length - 1];
        index++;
        return Promise.resolve(snapshot);
      });

      const leaks = await detectMemoryLeaks(mockPage, {
        duration: 10000,
        threshold: 0.1 // 10% growth threshold
      });
      
      Date.now = originalDateNow;

      expect(leaks).toMatchObject({
        hasLeak: true,
        confidence: expect.any(Number),
        growthRate: expect.any(Number),
        details: expect.stringContaining('consistent growth')
      });
    });

    it('should not report false positives for stable memory', async () => {
      const stableMemory = Array.from({ length: 5 }, () => ({
        JSHeapUsedSize: 10000000 + Math.random() * 100000,
        timestamp: Date.now()
      }));

      // Mock Date.now to prevent infinite loop
      let currentTime = 0;
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => {
        const time = currentTime;
        currentTime += 10000; // Skip to end quickly
        return time;
      });

      let index = 0;
      mockPage.metrics.mockImplementation(() => {
        const snapshot = stableMemory[index] || stableMemory[stableMemory.length - 1];
        index++;
        return Promise.resolve(snapshot);
      });

      const leaks = await detectMemoryLeaks(mockPage);
      
      Date.now = originalDateNow;

      expect(leaks.hasLeak).toBe(false);
      expect(leaks.confidence).toBeLessThan(50);
    });

    it('should detect DOM node leaks', async () => {
      mockPage.evaluate.mockResolvedValue({
        domNodes: 5000,
        detachedNodes: 1000,
        listeners: 2000
      });

      const leaks = await detectMemoryLeaks(mockPage, {
        checkDOM: true
      });

      expect(leaks.domLeaks).toMatchObject({
        detachedNodes: 1000,
        excessiveListeners: true,
        recommendation: expect.stringContaining('detached nodes')
      });
    });

    it('should perform leak detection with user interactions', async () => {
      const leaks = await detectMemoryLeaks(mockPage, {
        scenario: 'repeated-action',
        actions: [
          { type: 'click', selector: '.open-modal' },
          { type: 'click', selector: '.close-modal' }
        ],
        iterations: 10
      });

      expect(mockPage.evaluate).toHaveBeenCalledTimes(expect.any(Number));
      expect(leaks.scenario).toBe('repeated-action');
    });
  });

  describe('analyzeHeapSnapshot', () => {
    it('should analyze heap snapshot for object distribution', async () => {
      mockCDPSession.send.mockImplementation((method) => {
        if (method === 'HeapProfiler.takeHeapSnapshot') {
          return Promise.resolve();
        }
        return Promise.resolve({});
      });

      const mockSnapshot = {
        nodes: [
          { type: 'object', name: 'Array', size: 1000000 },
          { type: 'object', name: 'Object', size: 500000 },
          { type: 'string', name: 'String', size: 200000 }
        ],
        totalSize: 1700000
      };

      mockCDPSession.on.mockImplementation((event, callback) => {
        if (event === 'HeapProfiler.addHeapSnapshotChunk') {
          callback({ chunk: JSON.stringify(mockSnapshot) });
        }
      });

      const analysis = await analyzeHeapSnapshot(mockPage);

      expect(analysis).toMatchObject({
        totalSize: 1700000,
        objectTypes: expect.objectContaining({
          Array: { count: 1, size: 1000000 },
          Object: { count: 1, size: 500000 }
        }),
        largestObjects: expect.arrayContaining([
          expect.objectContaining({ name: 'Array' })
        ])
      });
    });

    it('should identify retained objects', async () => {
      const mockSnapshot = {
        nodes: [{ retained: true, size: 5000000, path: 'window.cache' }],
        retainers: {
          'window.cache': ['globalObject', 'appState']
        }
      };

      mockCDPSession.on.mockImplementation((event, callback) => {
        if (event === 'HeapProfiler.addHeapSnapshotChunk') {
          callback({ chunk: JSON.stringify(mockSnapshot) });
        }
      });

      const analysis = await analyzeHeapSnapshot(mockPage, {
        findRetained: true
      });

      expect(analysis.retainedObjects).toContainEqual(
        expect.objectContaining({
          path: 'window.cache',
          size: 5000000
        })
      );
    });

    it('should compare heap snapshots', async () => {
      const snapshot1 = { nodes: [{ id: 1, size: 1000 }], totalSize: 1000 };
      const snapshot2 = { nodes: [{ id: 1, size: 1000 }, { id: 2, size: 2000 }], totalSize: 3000 };

      let snapshotCount = 0;
      mockCDPSession.on.mockImplementation((event, callback) => {
        if (event === 'HeapProfiler.addHeapSnapshotChunk') {
          callback({ 
            chunk: JSON.stringify(snapshotCount++ === 0 ? snapshot1 : snapshot2) 
          });
        }
      });

      const analysis = await analyzeHeapSnapshot(mockPage, {
        compare: true,
        baselineSnapshot: snapshot1
      });

      expect(analysis.diff).toMatchObject({
        sizeDelta: 2000,
        newObjects: 1,
        growth: 200 // 200% growth
      });
    });
  });

  describe('generateMemoryReport', () => {
    it('should generate comprehensive memory report', async () => {
      const mockData = {
        profile: {
          summary: {
            initialHeap: 10000000,
            finalHeap: 15000000,
            peakHeap: 18000000
          },
          samples: []
        },
        leaks: {
          hasLeak: true,
          confidence: 85,
          growthRate: 0.5
        },
        heapAnalysis: {
          totalSize: 15000000,
          objectTypes: {
            Array: { size: 5000000 },
            Object: { size: 3000000 }
          }
        },
        timestamp: new Date().toISOString()
      };

      const reportPath = await generateMemoryReport(mockData);

      expect(reportPath).toMatch(/reports\/memory-profile-.+\.html$/);
      expect(require('fs').promises.writeFile).toHaveBeenCalled();

      const calls = require('fs').promises.writeFile.mock.calls;
      const [_, content] = calls[calls.length - 1];
      expect(content).toContain('Memory Profile Report');
      expect(content).toContain('Memory leak detected');
      expect(content).toContain('85% confidence');
    });

    it('should include visualization data in report', async () => {
      const mockData = {
        profile: {
          samples: [
            { timestamp: 1000, heapUsed: 10000000 },
            { timestamp: 2000, heapUsed: 12000000 },
            { timestamp: 3000, heapUsed: 14000000 }
          ]
        }
      };

      await generateMemoryReport(mockData);

      const calls = require('fs').promises.writeFile.mock.calls;
      const [_, content] = calls[calls.length - 1];
      expect(content).toContain('chart-container');
      expect(content).toContain('memory-timeline');
    });

    it('should highlight critical memory issues', async () => {
      const mockData = {
        leaks: {
          hasLeak: true,
          domLeaks: {
            detachedNodes: 5000,
            excessiveListeners: true
          }
        },
        heapAnalysis: {
          retainedObjects: [
            { path: 'window.bigData', size: 50000000 }
          ]
        }
      };

      await generateMemoryReport(mockData);

      const calls = require('fs').promises.writeFile.mock.calls;
      const [_, content] = calls[calls.length - 1];
      expect(content).toContain('class="critical"');
      expect(content).toContain('5000 detached nodes');
      expect(content).toContain('window.bigData');
    });
  });

  describe('CLI interface', () => {
    it('should parse command line arguments', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'memory-profiler.js', '--leak-detection', '--duration', '30s'];

      const { mode, duration } = require('../memory-profiler').parseArgs();

      expect(mode).toBe('leak-detection');
      expect(duration).toBe(30000); // 30 seconds in ms

      process.argv = originalArgv;
    });

    it('should validate profiling modes', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'memory-profiler.js', '--invalid-mode'];

      const { mode } = require('../memory-profiler').parseArgs();
      expect(mode).toBe('profile'); // Default mode when invalid

      process.argv = originalArgv;
    });
  });

  describe('Production safety', () => {
    it('should limit heap snapshot size in production', async () => {
      process.env.NODE_ENV = 'production';

      await analyzeHeapSnapshot(mockPage);

      expect(mockCDPSession.send).toHaveBeenCalledWith(
        'HeapProfiler.takeHeapSnapshot',
        expect.objectContaining({
          reportProgress: false,
          treatGlobalObjectsAsRoots: true
        })
      );

      process.env.NODE_ENV = 'test';
    });

    it('should use sampling profiler in production', async () => {
      process.env.NODE_ENV = 'production';

      await profileMemoryUsage('http://localhost:3000', {
        production: true
      });

      expect(mockPage.metrics).toHaveBeenCalledTimes(3); // Limited samples

      process.env.NODE_ENV = 'test';
    });
  });
});