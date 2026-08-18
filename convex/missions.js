import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { calculateRank, resolveAgentFromSession } from "./auth.js";

// Record mission outcome, calculate points, update agent stats and ops feed.
// The agent is resolved from the caller's session token, not a client-
// supplied callsign, so a client can only ever score against its own account.
export const logMissionOutcome = mutation({
  args: {
    sessionToken: v.string(),
    targetCodename: v.string(),
    outcome: v.string(), // "SUCCESS" | "FAILED"
    reason: v.string(),  // "ELIMINATED" | "TIMEOUT" | "OFF_TARGET" | "ABORTED"
    timeRemaining: v.number(),
  },
  handler: async (ctx, args) => {
    const agent = await resolveAgentFromSession(ctx, args.sessionToken);
    const cleanCallsign = agent.callsign;
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

// One-time migration: strip any legacy base64 evidencePhoto payloads left
// over from before evidence photos were removed. Run this once (e.g. `npx
// convex run missions:purgeLegacyEvidencePhotos`) before deploying the
// schema above, then this function can be deleted.
export const purgeLegacyEvidencePhotos = mutation({
  args: {},
  handler: async (ctx) => {
    const missions = await ctx.db.query("missions").collect();
    let purged = 0;
    for (const m of missions) {
      if ("evidencePhoto" in m) {
        await ctx.db.replace(m._id, {
          agentCallsign: m.agentCallsign,
          targetCodename: m.targetCodename,
          targetName: m.targetName,
          outcome: m.outcome,
          reason: m.reason,
          scoreEarned: m.scoreEarned,
          timeRemaining: m.timeRemaining,
          timestamp: m.timestamp,
        });
        purged++;
      }
    }
    return { purged, totalMissions: missions.length };
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
