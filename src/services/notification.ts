import { Redis } from '@upstash/redis';

export interface NotificationToken {
  token: string;
  url: string;
  createdAt: number;
}

export interface NotificationData {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
}

export interface NotificationPreferences {
  tokenLaunched: boolean;
  tokenMilestones: boolean;
  followerActivity: boolean;
  castMentions: boolean;
  creatorRewards: boolean;
}

export interface BatchNotificationItem {
  fid: number;
  notification: NotificationData;
}

export interface BatchNotificationResult {
  fid: number;
  success: boolean;
  error?: string;
}

export class NotificationService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }

  async saveNotificationToken(fid: number, token: string, url: string): Promise<void> {
    try {
      const tokenData: NotificationToken = {
        token,
        url,
        createdAt: Date.now()
      };

      await this.redis.set(
        `notification:token:${fid}`,
        JSON.stringify(tokenData),
        { ex: 60 * 60 * 24 * 90 } // 90 days initial TTL, refreshed on each successful notification
      );
    } catch {
      throw new Error('Failed to save notification token');
    }
  }

  async getNotificationToken(fid: number): Promise<NotificationToken | null> {
    const data = await this.redis.get(`notification:token:${fid}`);
    if (!data) return null;
    
    return JSON.parse(data as string);
  }

  async removeNotificationToken(fid: number): Promise<void> {
    await this.redis.del(`notification:token:${fid}`);
  }

  async sendNotification(fid: number, notification: NotificationData): Promise<void> {
    // Check rate limit
    const rateLimitKey = `notification:ratelimit:${fid}`;
    const isRateLimited = await this.redis.get(rateLimitKey);
    
    if (isRateLimited) {
      throw new Error('Rate limit exceeded. Please wait 30 seconds between notifications.');
    }

    // Get notification token
    const tokenData = await this.getNotificationToken(fid);
    if (!tokenData) {
      throw new Error('No notification token found for user');
    }

    // Check user preferences
    const preferences = await this.getPreferences(fid);
    if (!this.shouldSendNotification(notification, preferences)) {
      return;
    }

    // Send notification
    const response = await fetch(tokenData.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.token}`
      },
      body: JSON.stringify(notification)
    });

    if (!response.ok) {
      throw new Error(`Failed to send notification: ${response.status} ${response.statusText}`);
    }

    // Set rate limit
    await this.redis.set(rateLimitKey, '1', { ex: 30 });
    
    // Refresh token expiration on successful notification
    // This ensures active users continue receiving notifications beyond the initial 90-day TTL
    await this.redis.expire(`notification:token:${fid}`, 60 * 60 * 24 * 90);
  }

  async sendBatchNotifications(notifications: BatchNotificationItem[]): Promise<BatchNotificationResult[]> {
    const results: BatchNotificationResult[] = [];

    for (const item of notifications) {
      try {
        await this.sendNotification(item.fid, item.notification);
        results.push({ fid: item.fid, success: true });
      } catch (error) {
        results.push({ 
          fid: item.fid, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return results;
  }

  async savePreferences(fid: number, preferences: NotificationPreferences): Promise<void> {
    await this.redis.set(
      `notification:preferences:${fid}`,
      JSON.stringify(preferences)
    );
  }

  async getPreferences(fid: number): Promise<NotificationPreferences> {
    const data = await this.redis.get(`notification:preferences:${fid}`);
    
    if (!data) {
      // Return default preferences
      return {
        tokenLaunched: true,
        tokenMilestones: true,
        followerActivity: true,
        castMentions: true,
        creatorRewards: true
      };
    }

    return JSON.parse(data as string);
  }

  private shouldSendNotification(notification: NotificationData, preferences: NotificationPreferences): boolean {
    // Determine notification type based on title or targetUrl
    if (notification.title.includes('Token Launched')) {
      return preferences.tokenLaunched;
    }
    if (notification.title.includes('Milestone') || notification.title.includes('milestone')) {
      return preferences.tokenMilestones;
    }
    if (notification.title.includes('follower') || notification.title.includes('Follower')) {
      return preferences.followerActivity;
    }
    if (notification.title.includes('mentioned') || notification.title.includes('Mentioned')) {
      return preferences.castMentions;
    }
    if (notification.title.includes('reward') || notification.title.includes('Reward')) {
      return preferences.creatorRewards;
    }

    // Default to sending if type is unknown
    return true;
  }
}