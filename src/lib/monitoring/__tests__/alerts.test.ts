import {
  checkForDiscrepancies,
  sendAlert,
  categorizeAlertSeverity,
  storeAlert,
  getRecentAlerts,
  updateAlertStatus,
  AlertData,
} from '../alerts';
import {
  fetchDeploymentData,
  verifyOnChainRewards,
  detectDiscrepancies,
  RewardDiscrepancy,
  DeploymentData,
  OnChainRewards,
} from '../rewards-monitor';

// Mock dependencies
jest.mock('@upstash/redis');
jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(() => mockRedis),
}));
jest.mock('../rewards-monitor');

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
};

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('Alerts System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkForDiscrepancies', () => {
    const mockDeployment: DeploymentData = {
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'Test Token',
      tokenSymbol: 'TEST',
      creatorAddress: '0xabcdef1234567890123456789012345678901234',
      creatorFid: '12345',
      deploymentDate: new Date().toISOString(),
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

    const mockOnChainRewards: OnChainRewards = {
      tokenAddress: mockDeployment.tokenAddress,
      totalFeesCollected: BigInt(1000000000000000000), // 1 ETH
      creatorFeesReceived: BigInt(700000000000000000), // 0.7 ETH (70% instead of 80%)
      platformFeesReceived: BigInt(300000000000000000), // 0.3 ETH
      creatorPercentage: 70,
      platformPercentage: 30,
      lastUpdated: new Date().toISOString(),
    };

    const mockDiscrepancy: RewardDiscrepancy = {
      tokenAddress: mockDeployment.tokenAddress,
      tokenName: mockDeployment.tokenName,
      expectedCreatorPercentage: 80,
      actualCreatorPercentage: 70,
      percentageDifference: 10,
      expectedCreatorFees: BigInt(800000000000000000),
      actualCreatorFees: BigInt(700000000000000000),
      feeDifference: BigInt(100000000000000000),
      severity: 'high',
    };

    it('should check deployments and create alerts for discrepancies', async () => {
      (fetchDeploymentData as jest.Mock).mockResolvedValue([mockDeployment]);
      (verifyOnChainRewards as jest.Mock).mockResolvedValue(mockOnChainRewards);
      (detectDiscrepancies as jest.Mock).mockReturnValue(mockDiscrepancy);
      mockRedis.get.mockResolvedValue([]);

      const alerts = await checkForDiscrepancies(24);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].tokenAddress).toBe(mockDeployment.tokenAddress);
      expect(alerts[0].severity).toBe('critical'); // Should be critical due to high percentage and revenue
      expect(alerts[0].type).toBe('fee_discrepancy');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should handle deployments with no fees collected', async () => {
      const noFeesRewards = { ...mockOnChainRewards, totalFeesCollected: BigInt(0) };
      
      (fetchDeploymentData as jest.Mock).mockResolvedValue([mockDeployment]);
      (verifyOnChainRewards as jest.Mock).mockResolvedValue(noFeesRewards);

      const alerts = await checkForDiscrepancies(24);

      expect(alerts).toHaveLength(0);
      expect(detectDiscrepancies).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (fetchDeploymentData as jest.Mock).mockRejectedValue(new Error('Fetch error'));

      await expect(checkForDiscrepancies(24)).rejects.toThrow('Failed to check for discrepancies');
    });

    it('should skip deployments with no on-chain data', async () => {
      (fetchDeploymentData as jest.Mock).mockResolvedValue([mockDeployment]);
      (verifyOnChainRewards as jest.Mock).mockResolvedValue(null);

      const alerts = await checkForDiscrepancies(24);

      expect(alerts).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch on-chain rewards')
      );
    });
  });

  describe('categorizeAlertSeverity', () => {
    it('should categorize as critical for high percentage and revenue impact', () => {
      const discrepancy: RewardDiscrepancy = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        expectedCreatorPercentage: 80,
        actualCreatorPercentage: 65,
        percentageDifference: 15,
        expectedCreatorFees: BigInt(800000000000000000),
        actualCreatorFees: BigInt(650000000000000000),
        feeDifference: BigInt(150000000000000000), // 0.15 ETH
        severity: 'high',
      };

      const severity = categorizeAlertSeverity(discrepancy, BigInt(1000000000000000000));
      expect(severity).toBe('critical');
    });

    it('should categorize as high for significant differences', () => {
      const discrepancy: RewardDiscrepancy = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        expectedCreatorPercentage: 80,
        actualCreatorPercentage: 74,
        percentageDifference: 6,
        expectedCreatorFees: BigInt(80000000000000000),
        actualCreatorFees: BigInt(74000000000000000),
        feeDifference: BigInt(6000000000000000), // 0.006 ETH
        severity: 'medium',
      };

      const severity = categorizeAlertSeverity(discrepancy, BigInt(100000000000000000));
      expect(severity).toBe('high');
    });

    it('should categorize as medium for moderate differences', () => {
      const discrepancy: RewardDiscrepancy = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        expectedCreatorPercentage: 80,
        actualCreatorPercentage: 77.5,
        percentageDifference: 2.5,
        expectedCreatorFees: BigInt(800000000000000),
        actualCreatorFees: BigInt(775000000000000),
        feeDifference: BigInt(25000000000000), // Much smaller amount
        severity: 'medium',
      };

      const severity = categorizeAlertSeverity(discrepancy, BigInt(1000000000000000));
      expect(severity).toBe('medium');
    });

    it('should categorize as low for minor differences', () => {
      const discrepancy: RewardDiscrepancy = {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        expectedCreatorPercentage: 80,
        actualCreatorPercentage: 79,
        percentageDifference: 1,
        expectedCreatorFees: BigInt(80000000000000),
        actualCreatorFees: BigInt(79000000000000),
        feeDifference: BigInt(1000000000000), // Very small amount
        severity: 'low',
      };

      const severity = categorizeAlertSeverity(discrepancy, BigInt(100000000000000));
      expect(severity).toBe('low');
    });
  });

  describe('sendAlert', () => {
    it('should log alert details to console', async () => {
      const alert: AlertData = {
        id: 'alert_123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        severity: 'high',
        type: 'fee_discrepancy',
        title: 'Fee Distribution Discrepancy',
        description: 'Test description',
        revenueAffected: BigInt(100000000000000000),
        percentageDifference: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      await sendAlert(alert);

      expect(console.log).toHaveBeenCalledWith(
        '🚨 ALERT:',
        expect.objectContaining({
          severity: 'HIGH',
          token: 'Test Token',
          type: 'fee_discrepancy',
        })
      );
    });

    it('should reject invalid alert data', async () => {
      const invalidAlert = {
        id: 'alert_123',
        tokenAddress: 'invalid-address',
      } as AlertData;

      await expect(sendAlert(invalidAlert)).rejects.toThrow('Invalid alert data');
    });
  });

  describe('storeAlert', () => {
    it('should store alert in multiple Redis indices', async () => {
      const alert: AlertData = {
        id: 'alert_123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        severity: 'high',
        type: 'fee_discrepancy',
        title: 'Test Alert',
        description: 'Test description',
        revenueAffected: BigInt(100000000000000000),
        percentageDifference: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      // Mock get calls to return empty arrays for indices
      mockRedis.get
        .mockResolvedValueOnce([]) // severity index
        .mockResolvedValueOnce([]) // token index
        .mockResolvedValueOnce([]); // active alerts

      await storeAlert(alert);

      // Check alert was stored
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('alert:alert_123'),
        alert
      );

      // Check severity index
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('alerts:severity:high'),
        expect.arrayContaining(['alert_123'])
      );

      // Check that set was called multiple times for different indices
      const setCalls = mockRedis.set.mock.calls;
      
      // Check we have all the expected calls
      expect(setCalls.length).toBe(4); // alert + 3 indices
      
      // Find the token index call
      const tokenIndexCall = setCalls.find(call => 
        typeof call[0] === 'string' && call[0].includes('alerts:token:')
      );
      expect(tokenIndexCall).toBeDefined();
      expect(tokenIndexCall[1]).toContain('alert_123');

      // Find the active alerts call
      const activeAlertsCall = setCalls.find(call => call[0] === 'alerts:active');
      expect(activeAlertsCall).toBeDefined();
      expect(activeAlertsCall[1]).toContain('alert_123');

      // Check expiry was set
      expect(mockRedis.expire).toHaveBeenCalledTimes(3);
    });

    it('should not duplicate alerts in indices', async () => {
      const alert: AlertData = {
        id: 'alert_123',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenName: 'Test Token',
        severity: 'high',
        type: 'fee_discrepancy',
        title: 'Test Alert',
        description: 'Test description',
        revenueAffected: BigInt(100000000000000000),
        percentageDifference: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      // Mock that alert_123 already exists in all indices
      mockRedis.get
        .mockResolvedValueOnce(['alert_123']) // severity index
        .mockResolvedValueOnce(['alert_123']) // token index  
        .mockResolvedValueOnce(['alert_123']); // active alerts

      await storeAlert(alert);

      // Should still set the alert data
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('alert:alert_123'),
        alert
      );

      // Since indices already contain the alert, they shouldn't be updated again
      // Only the alert data itself should be set
      expect(mockRedis.set).toHaveBeenCalledTimes(1); // Only the alert data
      
      // Verify no duplicates were added to indices
      expect(mockRedis.expire).toHaveBeenCalledTimes(1); // Only for the alert data
    });
  });

  describe('getRecentAlerts', () => {
    const mockAlert1: AlertData = {
      id: 'alert_1',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'Token 1',
      severity: 'critical',
      type: 'fee_discrepancy',
      title: 'Critical Alert',
      description: 'Test',
      revenueAffected: BigInt(1000000000000000000),
      percentageDifference: 15,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const mockAlert2: AlertData = {
      id: 'alert_2',
      tokenAddress: '0x2345678901234567890123456789012345678901',
      tokenName: 'Token 2',
      severity: 'medium',
      type: 'fee_discrepancy',
      title: 'Medium Alert',
      description: 'Test',
      revenueAffected: BigInt(100000000000000000),
      percentageDifference: 3,
      status: 'active',
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };

    it('should retrieve recent alerts with default options', async () => {
      mockRedis.get
        .mockResolvedValueOnce(['alert_1', 'alert_2']) // active alerts
        .mockResolvedValueOnce(mockAlert1) // alert_1 data
        .mockResolvedValueOnce(mockAlert2); // alert_2 data

      const alerts = await getRecentAlerts();

      expect(alerts).toHaveLength(2);
      expect(alerts[0].id).toBe('alert_1'); // Critical first
      expect(alerts[1].id).toBe('alert_2');
    });

    it('should filter by severity', async () => {
      // Mock will be called multiple times for date range iteration
      mockRedis.get.mockImplementation((key) => {
        if (typeof key === 'string' && key.includes('alerts:severity:critical:')) {
          // Return alert IDs for the severity index
          return Promise.resolve(['alert_1']);
        }
        if (key === 'alert:alert_1') {
          // Return the alert data
          return Promise.resolve(mockAlert1);
        }
        return Promise.resolve(null);
      });

      const alerts = await getRecentAlerts({ severity: 'critical' });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should filter by token address', async () => {
      mockRedis.get
        .mockResolvedValueOnce(['alert_1']) // token index
        .mockResolvedValueOnce(mockAlert1); // alert data

      const alerts = await getRecentAlerts({ 
        tokenAddress: '0x1234567890123456789012345678901234567890' 
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].tokenAddress).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should filter by status', async () => {
      const resolvedAlert = { ...mockAlert2, status: 'resolved' as const };
      
      mockRedis.get
        .mockResolvedValueOnce(['alert_1', 'alert_2']) // active alerts
        .mockResolvedValueOnce(mockAlert1) // alert_1 data (active)
        .mockResolvedValueOnce(resolvedAlert); // alert_2 data (resolved)

      const alerts = await getRecentAlerts({ status: 'active' });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].status).toBe('active');
    });

    it('should apply limit', async () => {
      mockRedis.get
        .mockResolvedValueOnce(['alert_1', 'alert_2']) // active alerts
        .mockResolvedValueOnce(mockAlert1)
        .mockResolvedValueOnce(mockAlert2);

      const alerts = await getRecentAlerts({ limit: 1 });

      expect(alerts).toHaveLength(1);
    });
  });

  describe('updateAlertStatus', () => {
    const mockAlert: AlertData = {
      id: 'alert_123',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      tokenName: 'Test Token',
      severity: 'high',
      type: 'fee_discrepancy',
      title: 'Test Alert',
      description: 'Test',
      revenueAffected: BigInt(100000000000000000),
      percentageDifference: 10,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    it('should update alert to acknowledged', async () => {
      mockRedis.get.mockResolvedValueOnce(mockAlert);

      await updateAlertStatus('alert_123', 'acknowledged');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('alert:alert_123'),
        expect.objectContaining({
          status: 'acknowledged',
          acknowledgedAt: expect.any(String),
        })
      );
    });

    it('should update alert to resolved and remove from active list', async () => {
      mockRedis.get
        .mockResolvedValueOnce(mockAlert) // Get alert
        .mockResolvedValueOnce(['alert_123', 'alert_456']); // Get active alerts

      await updateAlertStatus('alert_123', 'resolved');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('alert:alert_123'),
        expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(String),
        })
      );

      // Check removed from active alerts
      expect(mockRedis.set).toHaveBeenCalledWith(
        'alerts:active',
        ['alert_456'] // alert_123 removed
      );
    });

    it('should throw error if alert not found', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      await expect(updateAlertStatus('alert_123', 'acknowledged'))
        .rejects.toThrow('Alert not found');
    });
  });
});