import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// Calculate clearance rank from total score
export function calculateRank(score) {
  if (score >= 25000) return "Balidan Director";
  if (score >= 12000) return "Brigadier";
  if (score >= 6000) return "Colonel";
  if (score >= 3000) return "Major";
  if (score >= 1000) return "Captain";
  return "2nd Lieutenant";
}

// Authenticate or register an agent by callsign
export const loginOrRegister = mutation({
  args: {
    callsign: v.string(),
    passcode: v.optional(v.string()),
    squadron: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanCallsign = args.callsign.trim().toUpperCase() || "AGENT DHURANDAR";
    
    // Check existing agent
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_callsign", (q) => q.eq("callsign", cleanCallsign))
      .first();

    const now = Date.now();

    if (existing) {
      // Update last active
      await ctx.db.patch(existing._id, {
        lastActive: now,
        squadron: args.squadron || existing.squadron || "PARA SF",
      });
      return {
        agent: {
          ...existing,
          eliminatedTargets: existing.eliminatedTargets || [],
          lastActive: now,
        },
        isNew: false,
      };
    }

    // Register new agent
    const newAgent = {
      callsign: cleanCallsign,
      passcode: args.passcode || "",
      clearanceRank: "2nd Lieutenant",
      totalScore: 0,
      missionsCompleted: 0,
      missionsFailed: 0,
      salutesGiven: 0,
      squadron: args.squadron || "PARA SF",
      badges: ["RECON READY"],
      eliminatedTargets: [],
      lastActive: now,
    };

    const id = await ctx.db.insert("agents", newAgent);

    // Push event to live ops feed
    await ctx.db.insert("opsFeed", {
      type: "INTEL",
      agentCallsign: cleanCallsign,
      headline: `OPERATIVE ENLISTED // ${cleanCallsign}`,
      detail: `Agent reported for duty with clearance rank 2nd Lieutenant (${newAgent.squadron}).`,
      timestamp: now,
    });

    return {
      agent: { _id: id, ...newAgent },
      isNew: true,
    };
  },
});

// Query agent profile
export const getProfile = query({
  args: { callsign: v.string() },
  handler: async (ctx, args) => {
    const cleanCallsign = args.callsign.trim().toUpperCase();
    return await ctx.db
      .query("agents")
      .withIndex("by_callsign", (q) => q.eq("callsign", cleanCallsign))
      .first();
  },
});
