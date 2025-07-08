import { internalMutation } from "./_generated/server";
import { ConvexCache } from "./lib/convexCache";

/**
 * Internal mutation to clean up expired cache entries
 */
export const cleanupExpiredCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all expired cache entries
    const expiredEntries = await ctx.db
      .query("cache")
      .withIndex("by_expiry")
      .filter(q => q.lt(q.field("expiresAt"), now))
      .collect();

    // Delete expired entries
    let deletedCount = 0;
    for (const entry of expiredEntries) {
      await ctx.db.delete(entry._id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired cache entries`);
    }

    return deletedCount;
  },
});