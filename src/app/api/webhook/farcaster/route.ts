import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { NotificationService } from '@/services/notification';

interface WebhookEvent {
  event: 'frame_added' | 'frame_removed' | 'notifications_enabled' | 'notifications_disabled' | string;
  fid: number;
  notificationDetails?: {
    token: string;
    url: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('X-Webhook-Signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
    }

    const body = await request.text();
    const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Parse webhook event
    const event: WebhookEvent = JSON.parse(body);
    const notificationService = new NotificationService();

    // Handle different event types
    switch (event.event) {
      case 'frame_added':
      case 'notifications_enabled':
        // User added the app or enabled notifications
        if (!event.notificationDetails) {
          return NextResponse.json({ error: 'Missing notification details' }, { status: 400 });
        }
        
        await notificationService.saveNotificationToken(
          event.fid,
          event.notificationDetails.token,
          event.notificationDetails.url
        );
        
        return NextResponse.json({ success: true });

      case 'frame_removed':
      case 'notifications_disabled':
        // User removed the app or disabled notifications
        await notificationService.removeNotificationToken(event.fid);
        return NextResponse.json({ success: true });

      default:
        // Unknown event type - log but don't fail
        console.log(`Unhandled webhook event: ${event.event}`);
        return NextResponse.json({ 
          success: true, 
          message: `Event not handled: ${event.event}` 
        });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}