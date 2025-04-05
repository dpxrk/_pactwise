// src/middleware.ts (or app/middleware.ts depending on your Next.js structure)

import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server"; // Import Next.js response object


// --- Route Matchers ---
// Combine protected routes from both examples
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/forum(.*)',
  "/product(.*)", // Includes /product and /product/*
  "/contracts(.*)",
  "/vendors(.*)",
  "/settings(.*)",
  "/profile(.*)",
]);

// Match sign-in/sign-up pages (adjust paths based on your actual Clerk setup)
const isSignInOrSignUpPage = createRouteMatcher([
  '/sign-in(.*)', // Matches /sign-in and /sign-in/*
  '/sign-up(.*)', // Matches /sign-up and /sign-up/*
  // Add any other specific auth-related pages you want logged-in users redirected away from
  // e.g., '/forgot-password(.*)' if applicable
]);

// --- Clerk Middleware ---
export default clerkMiddleware(async (auth, req) => {
  const authResult = await auth();
  const { userId } = authResult; // Now userId will be correctly extracted after the promise resolves

  const { pathname, search, origin } = req.nextUrl;
  const pathWithQuery = pathname + search;

  console.log(`Processing path: ${pathWithQuery}, User ID: ${userId || 'Not logged in'}`);

  // --- Logic for Protected Routes ---
  // If the user is not logged in and trying to access a protected route...
  if (!userId && isProtectedRoute(req)) {
    console.log(`Unauthenticated access attempt to protected route: ${pathname}. Redirecting to sign-in.`);
    return authResult.redirectToSignIn({ returnBackUrl: req.url });
  }

  // --- Logic for Auth Pages (Sign-in/Sign-up) ---
  // If the user IS logged in and trying to access a sign-in/sign-up page...
  if (userId && isSignInOrSignUpPage(req)) {
    console.log(`Authenticated user accessing auth page: ${pathname}. Redirecting away.`);

    let redirectTo = "/dashboard"; // Default page to redirect logged-in users to
    const redirectParam = req.nextUrl.searchParams.get('redirect');

    // Honor the redirect parameter if present and valid/safe
    if (redirectParam) {
        try {
            // Ensure it's a relative path or same origin
            const redirectUrl = new URL(redirectParam, origin); // Use origin as base
            if (redirectUrl.origin === origin) {
                redirectTo = redirectParam; // Use the validated parameter
            } else {
                console.warn(`Ignoring potentially unsafe cross-origin redirect parameter: ${redirectParam}`);
            }
        } catch (e) {
            // If redirectParam is not a valid relative path or URL part, ignore it
            console.warn(`Invalid redirect parameter format: ${redirectParam}`);
        }
    }

    console.log(`Redirecting authenticated user to: ${redirectTo}`);
    // Use NextResponse.redirect for custom redirects away from auth pages
    // Ensure the redirect URL is absolute
    const absoluteRedirectUrl = new URL(redirectTo, origin);
    return NextResponse.redirect(absoluteRedirectUrl.toString());
  }

  // --- Allow Request ---
  // If none of the above conditions were met (e.g., accessing a public page,
  // or a logged-in user accessing a non-auth page), allow the request to proceed.
  // This is the default behavior when the middleware function doesn't return a response.
  console.log(`Allowing request to proceed for path: ${pathname}`);
  return NextResponse.next(); // Explicitly allow is also fine
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
     * - Potentially API routes if they have separate auth (see note below)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.\\w+).*)',

    // Include API routes if they should be protected by Clerk session auth
    // '/(api|trpc)(.*)', // Uncomment this if your API routes rely on the Clerk session

    // Exclude specific API routes if needed, e.g., webhooks
    // '/((?!api/webhook).*)'
  ],
};