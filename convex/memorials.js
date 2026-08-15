import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// List all martyrs / memorials with live salute totals
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("memorials").collect();
  },
});

// Get martyr by slug
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memorials")
      .withIndex("by_slug", (q) => q.eq("id", args.id))
      .first();
  },
});

// Record a tribute / salute from an agent
export const salute = mutation({
  args: {
    memorialId: v.string(),
    agentCallsign: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const memorial = await ctx.db
      .query("memorials")
      .withIndex("by_slug", (q) => q.eq("id", args.memorialId))
      .first();

    if (!memorial) {
      throw new Error(`Memorial not found: ${args.memorialId}`);
    }

    const newSaluteCount = (memorial.salutesCount || 0) + 1;
    await ctx.db.patch(memorial._id, {
      salutesCount: newSaluteCount,
    });

    const now = Date.now();
    const cleanCallsign = args.agentCallsign.trim().toUpperCase() || "AGENT DHURANDAR";

    // Record tribute dedication
    await ctx.db.insert("tributes", {
      memorialId: args.memorialId,
      agentCallsign: cleanCallsign,
      message: args.message || "Saluted with Highest National Honors 🇮🇳",
      timestamp: now,
    });

    // Update agent's salute count
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_callsign", (q) => q.eq("callsign", cleanCallsign))
      .first();

    if (agent) {
      await ctx.db.patch(agent._id, {
        salutesGiven: (agent.salutesGiven || 0) + 1,
      });
    }

    // Broadcast tribute event to live ops feed
    await ctx.db.insert("opsFeed", {
      type: "TRIBUTE",
      agentCallsign: cleanCallsign,
      headline: `TRIBUTE PAID // ${memorial.name}`,
      detail: `${cleanCallsign} paid highest honors to ${memorial.name} (${memorial.decoration}). Total salutes: ${newSaluteCount}.`,
      timestamp: now,
    });

    return {
      success: true,
      salutesCount: newSaluteCount,
    };
  },
});

// Query recent tributes for a martyr
export const getTributes = query({
  args: { memorialId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const tributes = await ctx.db
      .query("tributes")
      .withIndex("by_memorial", (q) => q.eq("memorialId", args.memorialId))
      .order("desc")
      .take(limit);
    return tributes;
  },
});
