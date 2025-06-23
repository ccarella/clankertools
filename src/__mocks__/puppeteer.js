// Mock for puppeteer to avoid browser dependencies in tests
const puppeteer = {
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn().mockResolvedValue(),
      evaluate: jest.fn().mockResolvedValue({}),
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
    }),
    close: jest.fn().mockResolvedValue()
  })
};

module.exports = puppeteer;