import { query } from "./_generated/server.js";
import { v } from "convex/values";

// Get top operative agents sorted by total score & accuracy
export const getTopAgents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 25;
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_score")
      .order("desc")
      .take(limit);

    return agents.map((agent, idx) => {
      const totalOps = (agent.missionsCompleted || 0) + (agent.missionsFailed || 0);
      const accuracy = totalOps > 0 ? Math.round((agent.missionsCompleted / totalOps) * 100) : 100;

      return {
        rankNumber: idx + 1,
        callsign: agent.callsign,
        clearanceRank: agent.clearanceRank,
        totalScore: agent.totalScore,
        missionsCompleted: agent.missionsCompleted,
        missionsFailed: agent.missionsFailed,
        accuracy: `${accuracy}%`,
        squadron: agent.squadron || "PARA SF",
        badges: agent.badges || [],
        salutesGiven: agent.salutesGiven || 0,
      };
    });
  },
});
