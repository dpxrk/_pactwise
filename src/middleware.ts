// src/middleware.ts

import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window
const RATE_LIMIT_MAX_AUTH_ATTEMPTS = 5; // auth attempts per window

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Try to get IP from headers or fall back to 'unknown'
  const xRealIp = request.headers.get('x-real-ip');
  const xForwardedFor = request.headers.get('x-forwarded-for');
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  
  if (xRealIp) {
    return xRealIp;
  }
  
  // NextRequest doesn't have an ip property, so we default to 'unknown'
  return 'unknown';
}

// Rate limiting function
function isRateLimited(ip: string, key: string, maxRequests: number): boolean {
  const now = Date.now();
  const limitKey = `${ip}:${key}`;
  const record = rateLimitStore.get(limitKey);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(limitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}

// --- Route Matchers ---
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/forum(.*)',
  "/product(.*)",
  "/contracts(.*)",
  "/vendors(.*)",
  "/settings(.*)",
  "/profile(.*)",
  "/agents(.*)",
]);

// Match sign-in/sign-up pages
const isSignInOrSignUpPage = createRouteMatcher([
  '/auth/sign-in(.*)',
  '/auth/sign-up(.*)',
]);

// Match public pages that authenticated users should still be able to access
const isPublicPage = createRouteMatcher([
  '/',
  '/contact',
  '/about',
  '/features',
  '/pricing',
]);

// --- Clerk Middleware ---
export default clerkMiddleware(async (auth, req) => {
  const authResult = await auth();
  const { userId } = authResult;

  const { pathname, search, origin } = req.nextUrl;
  const pathWithQuery = pathname + search;
  const clientIP = getClientIP(req);

  console.log(`Processing path: ${pathWithQuery}, User ID: ${userId || 'Not logged in'}, IP: ${clientIP}`);

  // Rate limiting check
  const isAuthRoute = isSignInOrSignUpPage(req);
  const maxRequests = isAuthRoute ? RATE_LIMIT_MAX_AUTH_ATTEMPTS : RATE_LIMIT_MAX_REQUESTS;
  const rateLimitKey = isAuthRoute ? 'auth' : 'general';
  
  if (isRateLimited(clientIP, rateLimitKey, maxRequests)) {
    console.log(`Rate limit exceeded for IP: ${clientIP} on route: ${pathname}`);
    return new NextResponse('Too Many Requests', { 
      status: 429,
      headers: {
        'Retry-After': '900', // 15 minutes
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + RATE_LIMIT_WINDOW).toString(),
      },
    });
  }

  // --- Logic for Protected Routes ---
  if (!userId && isProtectedRoute(req)) {
    console.log(`Unauthenticated access attempt to protected route: ${pathname}. Redirecting to sign-in.`);
    // Create a return URL that will redirect to dashboard after sign-in
    const signInUrl = new URL('/auth/sign-in', origin);
    signInUrl.searchParams.set('redirect_url', '/dashboard');
    return NextResponse.redirect(signInUrl);
  }

  // --- Logic for Auth Pages (Sign-in/Sign-up) ---
  if (userId && isSignInOrSignUpPage(req)) {
    console.log(`Authenticated user accessing auth page: ${pathname}. Redirecting to dashboard.`);
    
    // Always redirect authenticated users to dashboard from auth pages
    const dashboardUrl = new URL('/dashboard', origin);
    return NextResponse.redirect(dashboardUrl);
  }

  // --- Handle root path redirect for authenticated users ---
  if (userId && pathname === '/') {
    console.log(`Authenticated user on homepage. Redirecting to dashboard.`);
    const dashboardUrl = new URL('/dashboard', origin);
    return NextResponse.redirect(dashboardUrl);
  }

  // --- Allow Request ---
  console.log(`Allowing request to proceed for path: ${pathname}`);
  
  // Add security headers
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  
  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // CSP Header
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.clerk.io https://*.sentry.io",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.convex.cloud https://*.clerk.io https://*.sentry.io wss://*.convex.cloud",
    "frame-src 'self' https://accounts.google.com https://*.clerk.io",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  
  response.headers.set(
    'Content-Security-Policy',
    cspDirectives.join('; ')
  );
  
  return response;
});

// --- Middleware Configuration ---
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any files with extensions (e.g., .png, .jpg, .svg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.\\w+).*)',
  ],
};