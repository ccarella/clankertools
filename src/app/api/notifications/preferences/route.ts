import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
    }

    const notificationService = new NotificationService();
    const preferences = await notificationService.getPreferences(parseInt(fid));

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, preferences } = body;

    if (!fid || !preferences) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate preferences structure
    const requiredFields = ['tokenLaunched', 'tokenMilestones', 'followerActivity', 'castMentions', 'creatorRewards'];
    const hasAllFields = requiredFields.every(field => field in preferences);
    
    if (!hasAllFields) {
      return NextResponse.json({ error: 'Invalid preferences structure' }, { status: 400 });
    }

    const notificationService = new NotificationService();
    await notificationService.savePreferences(fid, preferences);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving preferences:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}