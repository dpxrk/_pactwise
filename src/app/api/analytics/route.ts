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

// Store events in memory for development (use proper analytics service in production)
const events: AnalyticsEvent[] = [];

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const event: AnalyticsEvent = await request.json();

    // Validate event structure
    if (!event.event || !event.timestamp || !event.sessionId) {
      return NextResponse.json(
        { error: 'Invalid event structure' },
        { status: 400 }
      );
    }

    // Add server-side metadata
    const enrichedEvent = {
      ...event,
      serverTimestamp: Date.now(),
      userAgent: request.headers.get('user-agent') || 'unknown',
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      authenticatedUserId: userId,
    };

    // Store event (in production, send to analytics service)
    events.push(enrichedEvent);

    // Keep only last 1000 events in memory
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }

    // Log important events
    if (['error', 'form_submit', 'feature_usage'].includes(event.event)) {
      console.log('Analytics Event:', enrichedEvent);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to process event' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Only allow authenticated users to view analytics in development
    if (process.env.NODE_ENV === 'development' && userId) {
      const searchParams = request.nextUrl.searchParams;
      const limit = parseInt(searchParams.get('limit') || '100');
      const eventType = searchParams.get('event');

      let filteredEvents = events;
      
      if (eventType) {
        filteredEvents = events.filter(e => e.event === eventType);
      }

      return NextResponse.json({
        events: filteredEvents.slice(-limit),
        total: filteredEvents.length,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve analytics' },
      { status: 500 }
    );
  }
}