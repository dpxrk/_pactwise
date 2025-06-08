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
import type * as agents_analytics from "../agents/analytics.js";
import type * as agents_financial from "../agents/financial.js";
import type * as agents_legal from "../agents/legal.js";
import type * as agents_manager from "../agents/manager.js";
import type * as agents_notifications from "../agents/notifications.js";
import type * as agents_secretary from "../agents/secretary.js";
import type * as contracts from "../contracts.js";
import type * as enterprises from "../enterprises.js";
import type * as notification_schema from "../notification_schema.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as presence from "../presence.js";
import type * as realtime from "../realtime.js";
import type * as search from "../search.js";
import type * as security_auditLogging from "../security/auditLogging.js";
import type * as security_monitoring from "../security/monitoring.js";
import type * as security_rateLimiting from "../security/rateLimiting.js";
import type * as security_rowLevelSecurity from "../security/rowLevelSecurity.js";
import type * as security_secureContractOperations from "../security/secureContractOperations.js";
import type * as security_secureWrapper from "../security/secureWrapper.js";
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
  "agents/analytics": typeof agents_analytics;
  "agents/financial": typeof agents_financial;
  "agents/legal": typeof agents_legal;
  "agents/manager": typeof agents_manager;
  "agents/notifications": typeof agents_notifications;
  "agents/secretary": typeof agents_secretary;
  contracts: typeof contracts;
  enterprises: typeof enterprises;
  notification_schema: typeof notification_schema;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  presence: typeof presence;
  realtime: typeof realtime;
  search: typeof search;
  "security/auditLogging": typeof security_auditLogging;
  "security/monitoring": typeof security_monitoring;
  "security/rateLimiting": typeof security_rateLimiting;
  "security/rowLevelSecurity": typeof security_rowLevelSecurity;
  "security/secureContractOperations": typeof security_secureContractOperations;
  "security/secureWrapper": typeof security_secureWrapper;
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
