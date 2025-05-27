/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agent_schema from "../agent_schema.js";
import type * as agents_financial from "../agents/financial.js";
import type * as agents_legal from "../agents/legal.js";
import type * as agents_manager from "../agents/manager.js";
import type * as agents_secretary from "../agents/secretary.js";
import type * as contracts from "../contracts.js";
import type * as enterprises from "../enterprises.js";
import type * as server from "../server.js";
import type * as users from "../users.js";
import type * as vendors from "../vendors.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agent_schema: typeof agent_schema;
  "agents/financial": typeof agents_financial;
  "agents/legal": typeof agents_legal;
  "agents/manager": typeof agents_manager;
  "agents/secretary": typeof agents_secretary;
  contracts: typeof contracts;
  enterprises: typeof enterprises;
  server: typeof server;
  users: typeof users;
  vendors: typeof vendors;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
