export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://gorgeous-zebra-74.clerk.accounts.dev/",
      applicationID: process.env.CONVEX_AUTH_APPLICATION_ID || "convex",
    },
  ]
}