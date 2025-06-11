import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

interface AnalyticsEvent {
  event: string;
  timestamp: number;
  url: string;
  userId?: string;
  properties?: Record<string, any>;
  sessionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const events: AnalyticsEvent[] = await request.json();

    // Validate events array
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Invalid events array' },
        { status: 400 }
      );
    }

    // Validate each event
    const validEvents = events.filter(event => 
      event.event && event.timestamp && event.sessionId
    );

    if (validEvents.length === 0) {
      return NextResponse.json(
        { error: 'No valid events found' },
        { status: 400 }
      );
    }

    // Process batch of events
    const enrichedEvents = validEvents.map(event => ({
      ...event,
      serverTimestamp: Date.now(),
      userAgent: request.headers.get('user-agent') || 'unknown',
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      authenticatedUserId: userId,
    }));

    // In production, send to analytics service
    // Example: await analyticsService.sendBatch(enrichedEvents);

    // Log batch processing
    console.log(`Processed analytics batch: ${enrichedEvents.length} events`);

    return NextResponse.json({ 
      success: true,
      processed: enrichedEvents.length,
      skipped: events.length - validEvents.length,
    });
  } catch (error) {
    console.error('Analytics batch error:', error);
    return NextResponse.json(
      { error: 'Failed to process event batch' },
      { status: 500 }
    );
  }
}