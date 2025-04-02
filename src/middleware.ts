import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Define public and protected routes
const isSignInPage = createRouteMatcher(["/signin", "/auth/sign-in"]);
const isSignUpPage = createRouteMatcher(["/signup", "/auth/sign-up"]);
const isAuthPage = createRouteMatcher([
  "/signin", 
  "/signup", 
  "/auth(.*)", 
  "/forgot-password",
  "/reset-password",
  "/verify-email"
]);

const isProtectedRoute = createRouteMatcher([
  "/product(.*)",
  "/dashboard(.*)",
  "/contracts(.*)",
  "/vendors(.*)",
  "/settings(.*)",
  "/profile(.*)"
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Check authentication status
  const isAuthenticated = await convexAuth.isAuthenticated();
  
   
  // Redirect authenticated users away from sign-in pages
  if ((isSignInPage(request) || isSignUpPage(request)) && isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
  
  // Redirect unauthenticated users to sign-in page
  if (isProtectedRoute(request) && !isAuthenticated) {
    // Add the intended URL as a redirect parameter
    const returnUrl = encodeURIComponent(request.nextUrl.pathname);
    return nextjsMiddlewareRedirect(request, `/auth/sign-in?redirect=${returnUrl}`);
  }

  // Allow the request to proceed
  return null;
}, { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } }); // 30 days cookie expiration

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};


