/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as feed from "../feed.js";
import type * as init from "../init.js";
import type * as leaderboard from "../leaderboard.js";
import type * as memorials from "../memorials.js";
import type * as missions from "../missions.js";
import type * as myFunctions from "../myFunctions.js";
import type * as targets from "../targets.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  feed: typeof feed;
  init: typeof init;
  leaderboard: typeof leaderboard;
  memorials: typeof memorials;
  missions: typeof missions;
  myFunctions: typeof myFunctions;
  targets: typeof targets;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
