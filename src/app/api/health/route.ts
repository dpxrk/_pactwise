import { NextRequest, NextResponse } from 'next/server';

// Health check endpoint
export async function GET() {
  try {
    // Basic health checks
    const healthChecks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'development',
    };

    return NextResponse.json(healthChecks, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }, 
      { status: 500 }
    );
  }
}

export async function HEAD() {
  // Simple health check for monitoring systems
  return new NextResponse(null, { status: 200 });
}