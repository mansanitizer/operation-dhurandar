import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// Uses the Web Crypto API (crypto.getRandomValues / crypto.subtle) that the
// default Convex function runtime provides — no "use node" action needed.
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function deriveHashHex(password, saltBytes, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(bits);
}

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await deriveHashHex(password, saltBytes, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toHex(saltBytes)}$${hashHex}`;
}

async function verifyPassword(password, stored) {
  const parts = (stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = parseInt(parts[1], 10);
  const saltBytes = fromHex(parts[2]);
  const actualHex = await deriveHashHex(password, saltBytes, iterations);
  return timingSafeEqual(actualHex, parts[3]);
}

function generateToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

function stripSecret(agent) {
  const { passwordHash, ...safeAgent } = agent;
  return safeAgent;
}

// Shared by other Convex functions (missions.js, memorials.js) to turn a
// client-supplied session token into the authenticated agent doc, instead of
// trusting a client-supplied callsign string.
export async function resolveAgentFromSession(ctx, token) {
  if (!token) throw new Error("Not authenticated. Please sign in.");
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Session expired. Please sign in again.");
  }
  const agent = await ctx.db.get(session.agentId);
  if (!agent) throw new Error("Account not found. Please sign in again.");
  return agent;
}

// Calculate clearance rank from total score
export function calculateRank(score) {
  if (score >= 25000) return "Balidan Director";
  if (score >= 12000) return "Brigadier";
  if (score >= 6000) return "Colonel";
  if (score >= 3000) return "Major";
  if (score >= 1000) return "Captain";
  return "2nd Lieutenant";
}

// Register a new agent by email, or log in an existing one. Verifies the
// password against the stored PBKDF2 hash and issues a fresh session token.
export const loginOrRegisterWithEmail = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    callsign: v.optional(v.string()),
    squadron: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (!args.password || args.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    let agent;
    let isNew = false;

    if (existing) {
      const valid = await verifyPassword(args.password, existing.passwordHash);
      if (!valid) throw new Error("Invalid email or password.");

      await ctx.db.patch(existing._id, {
        lastActive: now,
        squadron: args.squadron || existing.squadron || "PARA SF",
      });
      agent = { ...existing, lastActive: now };
    } else {
      const cleanCallsign =
        (args.callsign || "AGENT DHURANDAR").trim().toUpperCase().slice(0, 24) ||
        "AGENT DHURANDAR";

      const callsignTaken = await ctx.db
        .query("agents")
        .withIndex("by_callsign", (q) => q.eq("callsign", cleanCallsign))
        .first();
      if (callsignTaken) {
        throw new Error(`Callsign "${cleanCallsign}" is already taken. Choose another.`);
      }

      const newAgent = {
        email,
        passwordHash: await hashPassword(args.password),
        callsign: cleanCallsign,
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
      agent = { _id: id, ...newAgent };
      isNew = true;

      await ctx.db.insert("opsFeed", {
        type: "INTEL",
        agentCallsign: cleanCallsign,
        headline: `OPERATIVE ENLISTED // ${cleanCallsign}`,
        detail: `Agent reported for duty with clearance rank 2nd Lieutenant (${newAgent.squadron}).`,
        timestamp: now,
      });
    }

    // Always rotate a fresh session token on successful auth.
    const token = generateToken();
    await ctx.db.insert("sessions", {
      token,
      agentId: agent._id,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });

    return { agent: stripSecret(agent), token, isNew };
  },
});

// Resolve the current agent from a session token (used on app load to
// restore a session instead of trusting a cached localStorage profile).
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) return null;
    const agent = await ctx.db.get(session.agentId);
    return agent ? stripSecret(agent) : null;
  },
});

// Invalidate a session token (sign out).
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { status: "SUCCESS" };
  },
});

// Query agent profile (public leaderboard-style lookup by callsign — no secrets)
export const getProfile = query({
  args: { callsign: v.string() },
  handler: async (ctx, args) => {
    const cleanCallsign = args.callsign.trim().toUpperCase();
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_callsign", (q) => q.eq("callsign", cleanCallsign))
      .first();
    return agent ? stripSecret(agent) : null;
  },
});
