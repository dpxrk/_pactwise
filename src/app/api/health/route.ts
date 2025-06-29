import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Health check endpoint for production monitoring
export async function GET() {
  try {
    // Check various system components
    const checks = {
      server: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    };

    // Additional checks can be added here
    // For example: database connectivity, external service availability, etc.

    const isHealthy = Object.values(checks).every(
      (check) => check !== false && check !== null
    );

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'unhealthy',
        ...checks,
      },
      {
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  }
}