import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { invalidationHandlers } from "../src/lib/cache-invalidation";

// Health check endpoint
const health = httpAction(async (ctx, request) => {
  return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
});

// Cache invalidation webhook
const invalidateCache = httpAction(async (ctx, request) => {
  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, entityId, enterpriseId, metadata } = body;

    // Handle different invalidation types
    switch (type) {
      case "contract.updated":
        await invalidationHandlers.onContractUpdate(entityId, enterpriseId);
        break;
      
      case "vendor.updated":
        await invalidationHandlers.onVendorUpdate(entityId, enterpriseId);
        break;
      
      case "analytics.updated":
        await invalidationHandlers.onAnalyticsUpdate(metadata.analyticsType, enterpriseId);
        break;
      
      case "user.preferences.updated":
        await invalidationHandlers.onUserPreferencesUpdate(entityId);
        break;
      
      case "search.index.updated":
        await invalidationHandlers.onSearchIndexUpdate();
        break;
      
      case "bulk.contracts.updated":
        await invalidationHandlers.onBulkContractUpdate(enterpriseId);
        break;
      
      default:
        return new Response(`Unknown invalidation type: ${type}`, { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, type, entityId }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Cache invalidation error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
});

// Performance metrics endpoint
const metrics = httpAction(async (ctx, request) => {
  // This would typically return Prometheus-formatted metrics
  const metrics = [
    "# HELP convex_requests_total Total number of requests",
    "# TYPE convex_requests_total counter",
    "convex_requests_total 1000",
    "",
    "# HELP convex_request_duration_seconds Request duration in seconds",
    "# TYPE convex_request_duration_seconds histogram",
    "convex_request_duration_seconds_bucket{le=\"0.1\"} 800",
    "convex_request_duration_seconds_bucket{le=\"0.5\"} 950",
    "convex_request_duration_seconds_bucket{le=\"1\"} 990",
    "convex_request_duration_seconds_bucket{le=\"+Inf\"} 1000",
    "",
    "# HELP convex_active_connections Active WebSocket connections",
    "# TYPE convex_active_connections gauge",
    "convex_active_connections 42",
  ].join("\n");

  return new Response(metrics, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4",
    },
  });
});

// Create HTTP router
const http = httpRouter();

// Register routes
http.route({
  path: "/health",
  method: "GET",
  handler: health,
});

http.route({
  path: "/webhooks/cache-invalidate",
  method: "POST",
  handler: invalidateCache,
});

http.route({
  path: "/metrics",
  method: "GET",
  handler: metrics,
});

export default http;