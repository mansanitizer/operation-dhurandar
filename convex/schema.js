import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 1. Agents / Operators Auth & Profile
  agents: defineTable({
    email: v.string(), // lowercased, unique identity
    passwordHash: v.string(), // "pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>"
    callsign: v.string(),
    clearanceRank: v.string(), // "2nd Lieutenant", "Captain", "Major", "Colonel", "Brigadier", "Balidan Director"
    totalScore: v.number(),
    missionsCompleted: v.number(),
    missionsFailed: v.number(),
    salutesGiven: v.number(),
    squadron: v.optional(v.string()), // "PARA SF", "NSG BLACK CATS", "MARCOS", "GARUD"
    badges: v.optional(v.array(v.string())),
    eliminatedTargets: v.optional(v.array(v.string())), // Codenames of hostiles neutralized by this operative
    lastActive: v.number(),
  }).index("by_callsign", ["callsign"])
    .index("by_email", ["email"])
    .index("by_score", ["totalScore"]),

  // 1b. Active login sessions issued by convex/auth.js
  sessions: defineTable({
    token: v.string(),
    agentId: v.id("agents"),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  // 2. Hostile Targets & Recon Database (Supports CDN links)
  targets: defineTable({
    codename: v.string(),
    name: v.string(),
    threatLevel: v.string(), // "CRITICAL (CATEGORY 1)", "EXTREME", etc.
    role: v.string(),
    lastSeen: v.string(),
    description: v.string(),
    identifyingMarks: v.string(),
    faceImage: v.string(), // CDN link or local asset
    bodySprite: v.string(), // CDN link e.g. https://dhurandar-assets.pages.dev/sprites/...
    uapaSerialNo: v.optional(v.number()),
    gazetteRef: v.optional(v.string()),
    status: v.string(), // "ACTIVE" | "NEUTRALIZED" | "CAPTURED"
    baseScore: v.number(),
    neutralizedCount: v.number(),
  }).index("by_codename", ["codename"]),

  // 3. Hall of Heroes & Braveheart Memorials
  memorials: defineTable({
    id: v.string(), // slug e.g. "sandeep-unnikrishnan"
    name: v.string(),
    rank: v.string(),
    unit: v.string(),
    decoration: v.string(), // "Ashoka Chakra (Posthumous)", "Param Vir Chakra", etc.
    operation: v.string(),
    dateOfMartyrdom: v.string(),
    image: v.string(),
    quote: v.string(),
    writeUp: v.string(),
    salutesCount: v.number(),
    citations: v.optional(v.array(v.string())),
    links: v.optional(v.array(v.object({
      label: v.string(),
      url: v.string()
    }))),
  }).index("by_slug", ["id"]),

  // 4. Memorial Tributes & Respect Dedications
  tributes: defineTable({
    memorialId: v.string(),
    agentCallsign: v.string(),
    message: v.string(),
    timestamp: v.number(),
  }).index("by_memorial", ["memorialId"]),

  // 5. Tactical Mission Telemetry & Evidence Locker
  missions: defineTable({
    agentCallsign: v.string(),
    targetCodename: v.string(),
    targetName: v.string(),
    outcome: v.string(), // "SUCCESS" | "FAILED"
    reason: v.string(),  // "CAPTURED" | "TIMEOUT" | "OFF_TARGET"
    scoreEarned: v.number(),
    timeRemaining: v.number(),
    timestamp: v.number(),
  }).index("by_agent", ["agentCallsign"])
    .index("by_timestamp", ["timestamp"]),

  // 6. Live HQ Operations Ticker Feed
  opsFeed: defineTable({
    type: v.string(), // "NEUTRALIZATION" | "TRIBUTE" | "PROMOTION" | "INTEL"
    agentCallsign: v.string(),
    headline: v.string(),
    detail: v.string(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});
