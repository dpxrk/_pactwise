import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: number;
  url: string;
  userId?: string;
  sessionId: string;
  userAgent: string;
  context?: Record<string, any>;
}

// Store errors in memory for development (use proper error tracking service in production)
const errors: ErrorReport[] = [];

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const errorReport: ErrorReport = await request.json();

    // Validate error report structure
    if (!errorReport.message || !errorReport.timestamp) {
      return NextResponse.json(
        { error: 'Invalid error report structure' },
        { status: 400 }
      );
    }

    // Add server-side metadata
    const enrichedError = {
      ...errorReport,
      serverTimestamp: Date.now(),
      authenticatedUserId: userId,
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
    };

    // Store error (in production, send to error tracking service)
    errors.push(enrichedError);

    // Keep only last 500 errors in memory
    if (errors.length > 500) {
      errors.splice(0, errors.length - 500);
    }

    // Log error
    console.error('Client Error Report:', {
      message: enrichedError.message,
      stack: enrichedError.stack,
      url: enrichedError.url,
      userId: enrichedError.authenticatedUserId,
      timestamp: new Date(enrichedError.timestamp).toISOString(),
    });

    // In production, send to error tracking service like Sentry
    // Sentry.captureException(new Error(errorReport.message), {
    //   user: { id: userId },
    //   extra: errorReport.context,
    //   tags: {
    //     source: 'client',
    //     url: errorReport.url,
    //   },
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reporting error:', error);
    return NextResponse.json(
      { error: 'Failed to process error report' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Only allow authenticated admin users to view errors in development
    if (process.env.NODE_ENV === 'development' && userId) {
      const searchParams = request.nextUrl.searchParams;
      const limit = parseInt(searchParams.get('limit') || '50');

      return NextResponse.json({
        errors: errors.slice(-limit),
        total: errors.length,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve errors' },
      { status: 500 }
    );
  }
}