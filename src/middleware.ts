import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextRequest, NextResponse } from "next/server"; // Import NextRequest/Response

// Match specific auth paths OR anything under /auth/
const isAuthPage = createRouteMatcher([
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth", // Base auth page if any
  "/auth/(.*)", // Any subpath under /auth/ (more robust than /auth/*)
]);

// Match specific top-level protected routes OR anything under them
const isProtectedRoute = createRouteMatcher([
  "/product", "/product/(.*)", // /product and /product/anything
  "/dashboard", "/dashboard/(.*)",
  "/contracts", "/contracts/(.*)",
  "/vendors", "/vendors/(.*)",
  "/settings", "/settings/(.*)",
  "/profile", "/profile/(.*)",
]);

// Simplified matchers for specific pages (often used for redirecting *away* if logged in)
const isSignInOrSignUpPage = createRouteMatcher([
  "/signin",
  "/signup",
  "/auth/sign-in", // Keep specific auth paths if they exist
  "/auth/sign-up",
]);

export default convexAuthNextjsMiddleware(async (request: NextRequest, { convexAuth }) => {
  const { pathname, search } = request.nextUrl;
  const pathWithQuery = pathname + search;
  console.log(`Processing path: ${pathWithQuery}`);

  const isAuthenticated = await convexAuth.isAuthenticated();
  console.log(`Is authenticated: ${isAuthenticated}`);

  // Debug simplified matchers
  const onSignInOrSignUp = isSignInOrSignUpPage(request);
  const onProtectedRoute = isProtectedRoute(request);
  console.log(`Is sign-in/sign-up page: ${onSignInOrSignUp}`);
  console.log(`Is protected route: ${onProtectedRoute}`);

  const url = request.nextUrl.clone(); // Clone to safely modify searchParams

  // Redirect authenticated users away from sign-in/sign-up pages
  if (onSignInOrSignUp && isAuthenticated) {
    const redirectParam = url.searchParams.get('redirect');
    let redirectTo = "/dashboard"; // Default redirect
    if (redirectParam) {
        try {
            // Basic validation: Ensure it's a relative path or same origin
            const redirectUrl = new URL(redirectParam, request.url);
            if (redirectUrl.origin === request.nextUrl.origin) {
                redirectTo = redirectParam;
            } else {
                console.warn(`Ignoring potentially unsafe redirect parameter: ${redirectParam}`);
            }
        } catch (e) {
             // If redirectParam is not a valid URL/path, ignore it
             console.warn(`Invalid redirect parameter: ${redirectParam}`);
        }
    }
    console.log(`Redirecting authenticated user from auth page to: ${redirectTo}`);
    return nextjsMiddlewareRedirect(request, redirectTo);
  }

  // Redirect unauthenticated users trying to access protected routes
  if (onProtectedRoute && !isAuthenticated) {
    // Add the intended URL as a redirect parameter
    const returnUrl = encodeURIComponent(pathWithQuery); // Use the full path with query
    const signInUrl = `/auth/sign-in?redirect=${returnUrl}`;
    console.log(`Redirecting unauthenticated user to: ${signInUrl}`);
    return nextjsMiddlewareRedirect(request, signInUrl);
  }

  // Allow the request to proceed
  console.log(`Allowing request to proceed for path: ${pathname}`);
  return null; // Correctly allows the request to continue
}, { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } }); // 30 days cookie expiration


// 2. Review Next.js Middleware Matcher (`config.matcher`)
export const config = {
  /*
   * Match all request paths except for the ones starting with:
   * - api (API routes) - Important: API routes often need different auth (tokens, headers)
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.ico (favicon file)
   * - Any file extensions (e.g., .png, .jpg)
   */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.\\w+).*)',
  ],
};