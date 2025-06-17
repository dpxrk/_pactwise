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
import type * as agent_types from "../agent_types.js";
import type * as agents_analytics from "../agents/analytics.js";
import type * as agents_financial from "../agents/financial.js";
import type * as agents_initializeVendorAgent from "../agents/initializeVendorAgent.js";
import type * as agents_legal from "../agents/legal.js";
import type * as agents_manager from "../agents/manager.js";
import type * as agents_notifications from "../agents/notifications.js";
import type * as agents_secretary from "../agents/secretary.js";
import type * as agents_vendor from "../agents/vendor.js";
import type * as analytics from "../analytics.js";
import type * as contracts from "../contracts.js";
import type * as enterprises from "../enterprises.js";
import type * as events from "../events.js";
import type * as memory_consolidation from "../memory/consolidation.js";
import type * as memory_conversationThread from "../memory/conversationThread.js";
import type * as memory_index from "../memory/index.js";
import type * as memory_longTermMemory from "../memory/longTermMemory.js";
import type * as memory_memoryIntegration from "../memory/memoryIntegration.js";
import type * as memory_memoryMaintenance from "../memory/memoryMaintenance.js";
import type * as memory_shortTermMemory from "../memory/shortTermMemory.js";
import type * as memory_test from "../memory/test.js";
import type * as memory_schema from "../memory_schema.js";
import type * as monitoring from "../monitoring.js";
import type * as notification_schema from "../notification_schema.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as presence from "../presence.js";
import type * as realtime from "../realtime.js";
import type * as realtimeHelpers from "../realtimeHelpers.js";
import type * as search from "../search.js";
import type * as security_applyRateLimit from "../security/applyRateLimit.js";
import type * as security_auditLogging from "../security/auditLogging.js";
import type * as security_monitoring from "../security/monitoring.js";
import type * as security_rateLimitedExamples from "../security/rateLimitedExamples.js";
import type * as security_rateLimitedWrapper from "../security/rateLimitedWrapper.js";
import type * as security_rateLimiting from "../security/rateLimiting.js";
import type * as security_rowLevelSecurity from "../security/rowLevelSecurity.js";
import type * as security_secureContractOperations from "../security/secureContractOperations.js";
import type * as security_secureWrapper from "../security/secureWrapper.js";
import type * as server from "../server.js";
import type * as types_function_types from "../types/function_types.js";
import type * as types_schema_types from "../types/schema_types.js";
import type * as types from "../types.js";
import type * as userEvents from "../userEvents.js";
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
  agent_types: typeof agent_types;
  "agents/analytics": typeof agents_analytics;
  "agents/financial": typeof agents_financial;
  "agents/initializeVendorAgent": typeof agents_initializeVendorAgent;
  "agents/legal": typeof agents_legal;
  "agents/manager": typeof agents_manager;
  "agents/notifications": typeof agents_notifications;
  "agents/secretary": typeof agents_secretary;
  "agents/vendor": typeof agents_vendor;
  analytics: typeof analytics;
  contracts: typeof contracts;
  enterprises: typeof enterprises;
  events: typeof events;
  "memory/consolidation": typeof memory_consolidation;
  "memory/conversationThread": typeof memory_conversationThread;
  "memory/index": typeof memory_index;
  "memory/longTermMemory": typeof memory_longTermMemory;
  "memory/memoryIntegration": typeof memory_memoryIntegration;
  "memory/memoryMaintenance": typeof memory_memoryMaintenance;
  "memory/shortTermMemory": typeof memory_shortTermMemory;
  "memory/test": typeof memory_test;
  memory_schema: typeof memory_schema;
  monitoring: typeof monitoring;
  notification_schema: typeof notification_schema;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  presence: typeof presence;
  realtime: typeof realtime;
  realtimeHelpers: typeof realtimeHelpers;
  search: typeof search;
  "security/applyRateLimit": typeof security_applyRateLimit;
  "security/auditLogging": typeof security_auditLogging;
  "security/monitoring": typeof security_monitoring;
  "security/rateLimitedExamples": typeof security_rateLimitedExamples;
  "security/rateLimitedWrapper": typeof security_rateLimitedWrapper;
  "security/rateLimiting": typeof security_rateLimiting;
  "security/rowLevelSecurity": typeof security_rowLevelSecurity;
  "security/secureContractOperations": typeof security_secureContractOperations;
  "security/secureWrapper": typeof security_secureWrapper;
  server: typeof server;
  "types/function_types": typeof types_function_types;
  "types/schema_types": typeof types_schema_types;
  types: typeof types;
  userEvents: typeof userEvents;
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
