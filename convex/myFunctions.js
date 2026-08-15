import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// Health check / connection test query
export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    return {
      status: "connected",
      system: "OPERATION DHURANDAR DB",
      timestamp: Date.now(),
    };
  },
});
