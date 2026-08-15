import { query } from "./_generated/server.js";
import { v } from "convex/values";

// Query recent tactical operational events for live ticker
export const getRecentEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 15;
    return await ctx.db
      .query("opsFeed")
      .order("desc")
      .take(limit);
  },
});
