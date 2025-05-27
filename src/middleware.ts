// src/middleware.ts

import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

  console.log(`Processing path: ${pathWithQuery}, User ID: ${userId || 'Not logged in'}`);

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
  return NextResponse.next();
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