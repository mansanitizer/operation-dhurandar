import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { calculateRank } from "./auth.js";

// Record mission outcome, calculate points, update agent stats and ops feed
export const logMissionOutcome = mutation({
  args: {
    agentCallsign: v.string(),
    targetCodename: v.string(),
    outcome: v.string(), // "SUCCESS" | "FAILED"
    reason: v.string(),  // "ELIMINATED" | "TIMEOUT" | "OFF_TARGET" | "ABORTED"
    timeRemaining: v.number(),
    evidencePhoto: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const cleanCallsign = args.agentCallsign.trim().toUpperCase() || "AGENT DHURANDAR";
    const now = Date.now();

    // 1. Fetch target details
    const target = await ctx.db
      .query("targets")
      .withIndex("by_codename", (q) => q.eq("codename", args.targetCodename))
      .first();

    const targetName = target ? target.name : args.targetCodename;
    const baseScore = target ? (target.baseScore || 1000) : 1000;

    // 2. Calculate points
    let scoreEarned = 0;
    if (args.outcome === "SUCCESS") {
      const timeBonus = Math.round(Math.max(0, args.timeRemaining) * 200);
      const speedBonus = args.timeRemaining >= 3.0 ? 300 : (args.timeRemaining >= 1.5 ? 150 : 0);
      scoreEarned = baseScore + timeBonus + speedBonus;
    }

    // 3. Log mission telemetry
    const missionId = await ctx.db.insert("missions", {
      agentCallsign: cleanCallsign,
      targetCodename: args.targetCodename,
      targetName: targetName,
      outcome: args.outcome,
      reason: args.reason,
      scoreEarned: scoreEarned,
      timeRemaining: args.timeRemaining,
      evidencePhoto: args.evidencePhoto,
      timestamp: now,
    });

    // 4. Update Target neutralization count
    if (target && args.outcome === "SUCCESS") {
      await ctx.db.patch(target._id, {
        neutralizedCount: (target.neutralizedCount || 0) + 1,
        status: "NEUTRALIZED",
      });
    }

    // 5. Update Agent Service Record & Clearance Rank
    let agent = await ctx.db
      .query("agents")
      .withIndex("by_callsign", (q) => q.eq("callsign", cleanCallsign))
      .first();

    if (!agent) {
      const newAgent = {
        callsign: cleanCallsign,
        passcode: "",
        clearanceRank: "2nd Lieutenant",
        totalScore: 0,
        missionsCompleted: 0,
        missionsFailed: 0,
        salutesGiven: 0,
        squadron: "PARA SF",
        badges: ["RECON READY"],
        lastActive: now,
      };
      const agentId = await ctx.db.insert("agents", newAgent);
      agent = { _id: agentId, ...newAgent };
    }

    const previousRank = agent.clearanceRank;
    const newTotalScore = (agent.totalScore || 0) + scoreEarned;
    const newMissionsCompleted = (agent.missionsCompleted || 0) + (args.outcome === "SUCCESS" ? 1 : 0);
    const newMissionsFailed = (agent.missionsFailed || 0) + (args.outcome === "FAILED" ? 1 : 0);
    const newRank = calculateRank(newTotalScore);

    const updatedBadges = [...(agent.badges || [])];
    if (args.outcome === "SUCCESS" && args.timeRemaining >= 3.5 && !updatedBadges.includes("DEADSHOT")) {
      updatedBadges.push("DEADSHOT");
    }
    if (newMissionsCompleted >= 5 && !updatedBadges.includes("BALIDAN COMMENDATION")) {
      updatedBadges.push("BALIDAN COMMENDATION");
    }

    const currentEliminated = agent.eliminatedTargets || [];
    const updatedEliminated = (args.outcome === "SUCCESS" && !currentEliminated.includes(args.targetCodename))
      ? [...currentEliminated, args.targetCodename]
      : currentEliminated;

    await ctx.db.patch(agent._id, {
      totalScore: newTotalScore,
      missionsCompleted: newMissionsCompleted,
      missionsFailed: newMissionsFailed,
      clearanceRank: newRank,
      badges: updatedBadges,
      eliminatedTargets: updatedEliminated,
      lastActive: now,
    });

    // 6. Broadcast event to live ops feed
    if (args.outcome === "SUCCESS") {
      await ctx.db.insert("opsFeed", {
        type: "NEUTRALIZATION",
        agentCallsign: cleanCallsign,
        headline: `TARGET ELIMINATED // ${args.targetCodename}`,
        detail: `${cleanCallsign} neutralized ${args.targetCodename} (${targetName}) in ${ (5.0 - args.timeRemaining).toFixed(2) }s (+${scoreEarned} PTS).`,
        timestamp: now,
      });

      // Rank Promotion announcement if rank increased
      if (newRank !== previousRank) {
        await ctx.db.insert("opsFeed", {
          type: "PROMOTION",
          agentCallsign: cleanCallsign,
          headline: `PROMOTION // ${cleanCallsign} → ${newRank.toUpperCase()}`,
          detail: `Operative promoted to ${newRank} for outstanding combat valor (Score: ${newTotalScore}).`,
          timestamp: now,
        });
      }
    } else {
      await ctx.db.insert("opsFeed", {
        type: "INTEL",
        agentCallsign: cleanCallsign,
        headline: `MISSION COMPROMISED // ${args.targetCodename}`,
        detail: `Operation in sector ended: ${args.reason} (${cleanCallsign}).`,
        timestamp: now,
      });
    }

    return {
      missionId,
      scoreEarned,
      totalScore: newTotalScore,
      clearanceRank: newRank,
      promoted: newRank !== previousRank,
      eliminatedTargets: updatedEliminated,
      timeBonus: args.outcome === "SUCCESS" ? Math.round(Math.max(0, args.timeRemaining) * 200) : 0,
    };
  },
});

// Query recent mission logs
export const getRecentMissions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("missions")
      .order("desc")
      .take(limit);
  },
});
