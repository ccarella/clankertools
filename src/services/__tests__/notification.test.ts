/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationService } from '../notification';

jest.mock('@upstash/redis');

// Import the mocked Redis after jest.mock
import { Redis } from '@upstash/redis';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let redisInstance: Redis;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
    // Get the Redis instance from the service
    redisInstance = (notificationService as any).redis;
  });

  describe('saveNotificationToken', () => {
    it('should save notification token for a user', async () => {
      const fid = 123;
      const token = 'notification-token-123';
      const url = 'https://warpcast.com/notifications';

      jest.spyOn(redisInstance, 'set').mockResolvedValueOnce('OK' as any);

      await notificationService.saveNotificationToken(fid, token, url);

      expect(redisInstance.set).toHaveBeenCalledWith(
        `notification:token:${fid}`,
        expect.stringContaining(token),
        { ex: 60 * 60 * 24 * 90 } // 90 days
      );
      
      // Verify the structure of the saved data
      const savedData = JSON.parse((redisInstance.set as jest.Mock).mock.calls[0][1]);
      expect(savedData).toMatchObject({ token, url });
      expect(typeof savedData.createdAt).toBe('number');
    });

    it('should throw error if Redis fails', async () => {
      const fid = 123;
      const token = 'notification-token-123';
      const url = 'https://warpcast.com/notifications';

      jest.spyOn(redisInstance, 'set').mockRejectedValueOnce(new Error('Redis error'));

      await expect(notificationService.saveNotificationToken(fid, token, url))
        .rejects.toThrow('Failed to save notification token');
    });
  });

  describe('getNotificationToken', () => {
    it('should retrieve notification token for a user', async () => {
      const fid = 123;
      const tokenData = {
        token: 'notification-token-123',
        url: 'https://warpcast.com/notifications',
        createdAt: Date.now()
      };

      jest.spyOn(redisInstance, 'get').mockResolvedValueOnce(JSON.stringify(tokenData) as any);

      const result = await notificationService.getNotificationToken(fid);

      expect(result).toEqual(tokenData);
      expect(redisInstance.get).toHaveBeenCalledWith(`notification:token:${fid}`);
    });

    it('should return null if no token exists', async () => {
      const fid = 123;

      jest.spyOn(redisInstance, 'get').mockResolvedValueOnce(null as any);

      const result = await notificationService.getNotificationToken(fid);

      expect(result).toBeNull();
    });
  });

  describe('removeNotificationToken', () => {
    it('should remove notification token for a user', async () => {
      const fid = 123;

      // Add del method to the mock
      (redisInstance as any).del = jest.fn().mockResolvedValueOnce(1);

      await notificationService.removeNotificationToken(fid);

      expect(redisInstance.del).toHaveBeenCalledWith(`notification:token:${fid}`);
    });
  });

  describe('sendNotification', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should send notification successfully', async () => {
      const fid = 123;
      const notification = {
        notificationId: 'notif-123',
        title: 'Token Launched!',
        body: 'Your token $TEST is now live on Clanker',
        targetUrl: 'https://clankertools.com/token/0x123'
      };
      const tokenData = {
        token: 'notification-token-123',
        url: 'https://warpcast.com/notifications',
        createdAt: Date.now()
      };

      jest.spyOn(redisInstance, 'get').mockImplementation((key: string) => {
        if (key === `notification:token:${fid}`) {
          return Promise.resolve(JSON.stringify(tokenData));
        }
        return Promise.resolve(null);
      });
      jest.spyOn(redisInstance, 'set').mockResolvedValue('OK' as any);
      jest.spyOn(redisInstance, 'expire').mockResolvedValue(1 as any);
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await notificationService.sendNotification(fid, notification);

      expect(global.fetch).toHaveBeenCalledWith(tokenData.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.token}`
        },
        body: JSON.stringify(notification)
      });
      
      // Check that rate limit was set
      expect(redisInstance.set).toHaveBeenCalledWith(
        `notification:ratelimit:${fid}`,
        '1',
        { ex: 30 }
      );
      
      // Check that token expiration was refreshed
      expect(redisInstance.expire).toHaveBeenCalledWith(
        `notification:token:${fid}`,
        60 * 60 * 24 * 90
      );
    });

    it('should throw error if no token exists', async () => {
      const fid = 123;
      const notification = {
        notificationId: 'notif-123',
        title: 'Test',
        body: 'Test body',
        targetUrl: 'https://example.com'
      };

      jest.spyOn(redisInstance, 'get').mockResolvedValueOnce(null as any);

      await expect(notificationService.sendNotification(fid, notification))
        .rejects.toThrow('No notification token found for user');
    });

    it('should throw error if notification fails', async () => {
      const fid = 123;
      const notification = {
        notificationId: 'notif-123',
        title: 'Test',
        body: 'Test body',
        targetUrl: 'https://example.com'
      };
      const tokenData = {
        token: 'notification-token-123',
        url: 'https://warpcast.com/notifications',
        createdAt: Date.now()
      };

      jest.spyOn(redisInstance, 'get').mockImplementation((key: string) => {
        if (key === `notification:token:${fid}`) {
          return Promise.resolve(JSON.stringify(tokenData));
        }
        // Return null for rate limit key
        return Promise.resolve(null);
      });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(notificationService.sendNotification(fid, notification))
        .rejects.toThrow('Failed to send notification: 400 Bad Request');
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limit of 1 notification per 30 seconds', async () => {
      const fid = 123;
      const notification = {
        notificationId: 'notif-123',
        title: 'Test',
        body: 'Test body',
        targetUrl: 'https://example.com'
      };
      const tokenData = {
        token: 'notification-token-123',
        url: 'https://warpcast.com/notifications',
        createdAt: Date.now()
      };

      jest.spyOn(redisInstance, 'get').mockImplementation((key: string) => {
        if (key === `notification:token:${fid}`) {
          return Promise.resolve(JSON.stringify(tokenData));
        }
        if (key === `notification:ratelimit:${fid}`) {
          return Promise.resolve('1');
        }
        return Promise.resolve(null);
      });

      await expect(notificationService.sendNotification(fid, notification))
        .rejects.toThrow('Rate limit exceeded. Please wait 30 seconds between notifications.');
    });

    it('should set rate limit after successful notification', async () => {
      const fid = 123;
      const notification = {
        notificationId: 'notif-123',
        title: 'Test',
        body: 'Test body',
        targetUrl: 'https://example.com'
      };
      const tokenData = {
        token: 'notification-token-123',
        url: 'https://warpcast.com/notifications',
        createdAt: Date.now()
      };

      jest.spyOn(redisInstance, 'get').mockImplementation((key: string) => {
        if (key === `notification:token:${fid}`) {
          return Promise.resolve(JSON.stringify(tokenData));
        }
        return Promise.resolve(null);
      });
      jest.spyOn(redisInstance, 'set').mockResolvedValueOnce('OK' as any);
      jest.spyOn(redisInstance, 'expire').mockResolvedValue(1 as any);
      
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await notificationService.sendNotification(fid, notification);

      expect(redisInstance.set).toHaveBeenCalledWith(
        `notification:ratelimit:${fid}`,
        '1',
        { ex: 30 }
      );
      
      // Verify token expiration was refreshed
      expect(redisInstance.expire).toHaveBeenCalledWith(
        `notification:token:${fid}`,
        60 * 60 * 24 * 90
      );
    });
  });

  describe('notification preferences', () => {
    it('should save notification preferences', async () => {
      const fid = 123;
      const preferences = {
        tokenLaunched: true,
        tokenMilestones: true,
        followerActivity: false,
        castMentions: true,
        creatorRewards: true
      };

      jest.spyOn(redisInstance, 'set').mockResolvedValueOnce('OK' as any);

      await notificationService.savePreferences(fid, preferences);

      expect(redisInstance.set).toHaveBeenCalledWith(
        `notification:preferences:${fid}`,
        JSON.stringify(preferences)
      );
    });

    it('should get notification preferences', async () => {
      const fid = 123;
      const preferences = {
        tokenLaunched: true,
        tokenMilestones: true,
        followerActivity: false,
        castMentions: true,
        creatorRewards: true
      };

      jest.spyOn(redisInstance, 'get').mockResolvedValueOnce(JSON.stringify(preferences) as any);

      const result = await notificationService.getPreferences(fid);

      expect(result).toEqual(preferences);
    });

    it('should return default preferences if none exist', async () => {
      const fid = 123;

      jest.spyOn(redisInstance, 'get').mockResolvedValueOnce(null as any);

      const result = await notificationService.getPreferences(fid);

      expect(result).toEqual({
        tokenLaunched: true,
        tokenMilestones: true,
        followerActivity: true,
        castMentions: true,
        creatorRewards: true
      });
    });
  });

  describe('batch notifications', () => {
    it('should send notifications to multiple users', async () => {
      const notifications = [
        { fid: 123, notification: { notificationId: '1', title: 'Test 1', body: 'Body 1', targetUrl: 'https://example.com/1' } },
        { fid: 456, notification: { notificationId: '2', title: 'Test 2', body: 'Body 2', targetUrl: 'https://example.com/2' } }
      ];

      const token1 = { token: 'token-123', url: 'https://warpcast.com/notifications', createdAt: Date.now() };
      const token2 = { token: 'token-456', url: 'https://warpcast.com/notifications', createdAt: Date.now() };

      jest.spyOn(redisInstance, 'get').mockImplementation((key: string) => {
        if (key === 'notification:token:123') return Promise.resolve(JSON.stringify(token1));
        if (key === 'notification:token:456') return Promise.resolve(JSON.stringify(token2));
        return Promise.resolve(null);
      });
      jest.spyOn(redisInstance, 'set').mockResolvedValue('OK' as any);
      jest.spyOn(redisInstance, 'expire').mockResolvedValue(1 as any);

      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      const results = await notificationService.sendBatchNotifications(notifications);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch notifications', async () => {
      const notifications = [
        { fid: 123, notification: { notificationId: '1', title: 'Test 1', body: 'Body 1', targetUrl: 'https://example.com/1' } },
        { fid: 456, notification: { notificationId: '2', title: 'Test 2', body: 'Body 2', targetUrl: 'https://example.com/2' } }
      ];

      const token1 = { token: 'token-123', url: 'https://warpcast.com/notifications', createdAt: Date.now() };

      jest.spyOn(redisInstance, 'get').mockImplementation((key: string) => {
        if (key === 'notification:token:123') return Promise.resolve(JSON.stringify(token1));
        return Promise.resolve(null);
      });
      jest.spyOn(redisInstance, 'set').mockResolvedValue('OK' as any);
      jest.spyOn(redisInstance, 'expire').mockResolvedValue(1 as any);

      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      const results = await notificationService.sendBatchNotifications(notifications);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('No notification token found for user');
    });
  });
});