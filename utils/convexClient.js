import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { targets as localTargets } from "../data/targets.js";
import { memorials as localMemorials } from "../data/memorials.js";

const convexUrl = import.meta.env?.VITE_CONVEX_URL || "https://friendly-vole-751.convex.cloud";

let client = null;
let isConnected = false;

try {
  if (convexUrl && !convexUrl.includes("your-deployment")) {
    client = new ConvexClient(convexUrl);
    isConnected = true;
    console.log("[CONVEX] Connected to live backend:", convexUrl);
  }
} catch (err) {
  console.warn("[CONVEX] Client init warning:", err);
}

export const ConvexService = {
  client,
  isConnected,

  // Session token issued by convex/auth.js on login/register. Every
  // authenticated mutation (scoring, salutes) is sent as this operative,
  // never as a client-supplied callsign string.
  sessionToken: null,

  setSessionToken(token) {
    this.sessionToken = token || null;
  },

  // 1. Auth: Register (if the email is new) or log in (verifying password)
  async loginOrRegisterWithEmail(email, password, callsign, squadron = "PARA SF") {
    if (!client) {
      return {
        agent: {
          email,
          callsign: (callsign || "AGENT DHURANDAR").toUpperCase(),
          clearanceRank: "2nd Lieutenant",
          totalScore: 0,
          missionsCompleted: 0,
          missionsFailed: 0,
          salutesGiven: 0,
          squadron,
          badges: ["RECON READY"],
          eliminatedTargets: [],
        },
        token: null,
        isNew: false,
      };
    }
    const res = await client.mutation(api.auth.loginOrRegisterWithEmail, {
      email,
      password,
      callsign,
      squadron,
    });
    this.setSessionToken(res.token);
    return res;
  },

  // Restore a session on app load by verifying a cached token against the DB
  // (never trust a cached local profile without server verification).
  async restoreSession(token) {
    if (!client || !token) return null;
    try {
      const agent = await client.query(api.auth.me, { token });
      if (agent) this.setSessionToken(token);
      return agent;
    } catch (err) {
      console.warn("[CONVEX] restoreSession failed:", err);
      return null;
    }
  },

  async logout() {
    if (client && this.sessionToken) {
      try {
        await client.mutation(api.auth.logout, { token: this.sessionToken });
      } catch (err) {
        console.warn("[CONVEX] logout error:", err);
      }
    }
    this.setSessionToken(null);
  },

  // 2. Fetch targets (with local fallback)
  async getTargets() {
    if (!client) return localTargets;
    try {
      const dbTargets = await client.query(api.targets.list, {});
      return dbTargets && dbTargets.length > 0 ? dbTargets : localTargets;
    } catch (err) {
      console.warn("[CONVEX] getTargets fallback to local:", err);
      return localTargets;
    }
  },

  // 3. Fetch Memorials (with local fallback)
  async getMemorials() {
    if (!client) return localMemorials;
    try {
      const dbMemorials = await client.query(api.memorials.list, {});
      return dbMemorials && dbMemorials.length > 0 ? dbMemorials : localMemorials;
    } catch (err) {
      console.warn("[CONVEX] getMemorials fallback to local:", err);
      return localMemorials;
    }
  },

  // 4. Record Salute / Tribute (requires an active session)
  async recordSalute(memorialId, message) {
    if (!client) return { success: true, salutesCount: 1948 };
    if (!this.sessionToken) {
      console.warn("[CONVEX] recordSalute skipped: not signed in");
      return { success: false, reason: "NOT_AUTHENTICATED" };
    }
    try {
      const res = await client.mutation(api.memorials.salute, {
        memorialId: memorialId || "sandeep-unnikrishnan",
        sessionToken: this.sessionToken,
        message: message || "Saluted with Highest National Honors 🇮🇳",
      });
      console.log("[CONVEX] Salute recorded live in DB:", res);
      return res;
    } catch (err) {
      console.error("[CONVEX] recordSalute error:", err);
      return { success: false };
    }
  },

  // 5. Record Mission Outcome & Scoring (requires an active session)
  async recordMissionOutcome({ targetCodename, outcome, reason, timeRemaining }) {
    const payload = {
      targetCodename: (targetCodename || "VALI-1").trim(),
      outcome: outcome || "SUCCESS",
      reason: reason || "ELIMINATED",
      timeRemaining: typeof timeRemaining === "number" ? Math.max(0, timeRemaining) : 0,
    };

    if (!client) {
      const score = outcome === "SUCCESS" ? 1000 + Math.round(payload.timeRemaining * 200) : 0;
      return {
        scoreEarned: score,
        totalScore: score,
        clearanceRank: "2nd Lieutenant",
        promoted: false,
      };
    }
    if (!this.sessionToken) {
      console.warn("[CONVEX] recordMissionOutcome skipped: not signed in");
      return null;
    }
    try {
      const res = await client.mutation(api.missions.logMissionOutcome, {
        ...payload,
        sessionToken: this.sessionToken,
      });
      console.log("[CONVEX] Mission outcome logged successfully:", res);
      return res;
    } catch (err) {
      console.error("[CONVEX] recordMissionOutcome error:", err);
      return null;
    }
  },

  // 6. Get Top Agents Leaderboard
  async getLeaderboard(limit = 20) {
    if (!client) return [];
    try {
      return await client.query(api.leaderboard.getTopAgents, { limit });
    } catch (err) {
      console.error("[CONVEX] getLeaderboard error:", err);
      return [];
    }
  },

  // 7. Subscribe to Live Ops Feed
  subscribeToFeed(callback) {
    if (!client) return () => {};
    try {
      return client.onUpdate(api.feed.getRecentEvents, { limit: 15 }, callback);
    } catch (err) {
      console.warn("[CONVEX] subscribeToFeed unavailable:", err);
      return () => {};
    }
  },

  // 8. Subscribe to Memorials for real-time salute counts
  subscribeToMemorials(callback) {
    if (!client) return () => {};
    try {
      return client.onUpdate(api.memorials.list, {}, callback);
    } catch (err) {
      console.warn("[CONVEX] subscribeToMemorials unavailable:", err);
      return () => {};
    }
  },

  // 9. Subscribe to Leaderboard
  subscribeToLeaderboard(callback) {
    if (!client) return () => {};
    try {
      return client.onUpdate(api.leaderboard.getTopAgents, { limit: 20 }, callback);
    } catch (err) {
      console.warn("[CONVEX] subscribeToLeaderboard unavailable:", err);
      return () => {};
    }
  },
};
