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
import type * as agentMemorySharing from "../agentMemorySharing.js";
import type * as agents_analytics from "../agents/analytics.js";
import type * as agents_financial from "../agents/financial.js";
import type * as agents_initializeVendorAgent from "../agents/initializeVendorAgent.js";
import type * as agents_legal from "../agents/legal.js";
import type * as agents_manager from "../agents/manager.js";
import type * as agents_notifications from "../agents/notifications.js";
import type * as agents_secretary from "../agents/secretary.js";
import type * as agents_vendor from "../agents/vendor.js";
import type * as ai_contractAnalyzer from "../ai/contractAnalyzer.js";
import type * as analytics from "../analytics.js";
import type * as auditLogging from "../auditLogging.js";
import type * as collaborativeDocuments from "../collaborativeDocuments.js";
import type * as contracts from "../contracts.js";
import type * as core_enterprises_enterprises from "../core/enterprises/enterprises.js";
import type * as core_index from "../core/index.js";
import type * as core_vendors_vendors from "../core/vendors/vendors.js";
import type * as coreUsers from "../coreUsers.js";
import type * as dashboardPreferences from "../dashboardPreferences.js";
import type * as demo from "../demo.js";
import type * as enhancedMemoryIntegration from "../enhancedMemoryIntegration.js";
import type * as enterprises from "../enterprises.js";
import type * as events from "../events.js";
import type * as features_analytics_analytics from "../features/analytics/analytics.js";
import type * as features_collaborative_collaborativeDocuments from "../features/collaborative/collaborativeDocuments.js";
import type * as features_demo from "../features/demo.js";
import type * as features_index from "../features/index.js";
import type * as features_search_search from "../features/search/search.js";
import type * as memoryConsolidation from "../memoryConsolidation.js";
import type * as memoryConsolidationInternal from "../memoryConsolidationInternal.js";
import type * as memoryConversationThread from "../memoryConversationThread.js";
import type * as memoryHelpers from "../memoryHelpers.js";
import type * as memoryIntegration from "../memoryIntegration.js";
import type * as memoryLongTerm from "../memoryLongTerm.js";
import type * as memoryMaintenance from "../memoryMaintenance.js";
import type * as memoryShortTerm from "../memoryShortTerm.js";
import type * as memoryTest from "../memoryTest.js";
import type * as migrations_addContractOwnership from "../migrations/addContractOwnership.js";
import type * as monitoring from "../monitoring.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as onboardingActions from "../onboardingActions.js";
import type * as onboardingConstants from "../onboardingConstants.js";
import type * as presence from "../presence.js";
import type * as realtime_events from "../realtime/events.js";
import type * as realtime_index from "../realtime/index.js";
import type * as realtime_presence from "../realtime/presence.js";
import type * as realtime_realtime from "../realtime/realtime.js";
import type * as realtime_realtimeHelpers from "../realtime/realtimeHelpers.js";
import type * as realtime_userEvents from "../realtime/userEvents.js";
import type * as realtime from "../realtime.js";
import type * as schemas_agent_schema from "../schemas/agent_schema.js";
import type * as schemas_collaborative_documents_schema from "../schemas/collaborative_documents_schema.js";
import type * as schemas_episodic_memory_schema from "../schemas/episodic_memory_schema.js";
import type * as schemas_memory_schema from "../schemas/memory_schema.js";
import type * as schemas_memory_sharing_schema from "../schemas/memory_sharing_schema.js";
import type * as schemas_notification_schema from "../schemas/notification_schema.js";
import type * as search from "../search.js";
import type * as security_applyRateLimit from "../security/applyRateLimit.js";
import type * as security_inputSanitization from "../security/inputSanitization.js";
import type * as security_monitoring from "../security/monitoring.js";
import type * as security_rateLimitedExamples from "../security/rateLimitedExamples.js";
import type * as security_rateLimitedWrapper from "../security/rateLimitedWrapper.js";
import type * as security_rateLimiting from "../security/rateLimiting.js";
import type * as security_rowLevelSecurity from "../security/rowLevelSecurity.js";
import type * as security_secureContractOperations from "../security/secureContractOperations.js";
import type * as security_secureWrapper from "../security/secureWrapper.js";
import type * as server from "../server.js";
import type * as shared_agent_types from "../shared/agent_types.js";
import type * as shared_index from "../shared/index.js";
import type * as shared_monitoring from "../shared/monitoring.js";
import type * as shared_notifications from "../shared/notifications.js";
import type * as shared_types from "../shared/types.js";
import type * as types_function_types from "../types/function_types.js";
import type * as types_schema_types from "../types/schema_types.js";
import type * as userEvents from "../userEvents.js";
import type * as users from "../users.js";
import type * as vectorEmbeddings from "../vectorEmbeddings.js";
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
  agentMemorySharing: typeof agentMemorySharing;
  "agents/analytics": typeof agents_analytics;
  "agents/financial": typeof agents_financial;
  "agents/initializeVendorAgent": typeof agents_initializeVendorAgent;
  "agents/legal": typeof agents_legal;
  "agents/manager": typeof agents_manager;
  "agents/notifications": typeof agents_notifications;
  "agents/secretary": typeof agents_secretary;
  "agents/vendor": typeof agents_vendor;
  "ai/contractAnalyzer": typeof ai_contractAnalyzer;
  analytics: typeof analytics;
  auditLogging: typeof auditLogging;
  collaborativeDocuments: typeof collaborativeDocuments;
  contracts: typeof contracts;
  "core/enterprises/enterprises": typeof core_enterprises_enterprises;
  "core/index": typeof core_index;
  "core/vendors/vendors": typeof core_vendors_vendors;
  coreUsers: typeof coreUsers;
  dashboardPreferences: typeof dashboardPreferences;
  demo: typeof demo;
  enhancedMemoryIntegration: typeof enhancedMemoryIntegration;
  enterprises: typeof enterprises;
  events: typeof events;
  "features/analytics/analytics": typeof features_analytics_analytics;
  "features/collaborative/collaborativeDocuments": typeof features_collaborative_collaborativeDocuments;
  "features/demo": typeof features_demo;
  "features/index": typeof features_index;
  "features/search/search": typeof features_search_search;
  memoryConsolidation: typeof memoryConsolidation;
  memoryConsolidationInternal: typeof memoryConsolidationInternal;
  memoryConversationThread: typeof memoryConversationThread;
  memoryHelpers: typeof memoryHelpers;
  memoryIntegration: typeof memoryIntegration;
  memoryLongTerm: typeof memoryLongTerm;
  memoryMaintenance: typeof memoryMaintenance;
  memoryShortTerm: typeof memoryShortTerm;
  memoryTest: typeof memoryTest;
  "migrations/addContractOwnership": typeof migrations_addContractOwnership;
  monitoring: typeof monitoring;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  onboardingActions: typeof onboardingActions;
  onboardingConstants: typeof onboardingConstants;
  presence: typeof presence;
  "realtime/events": typeof realtime_events;
  "realtime/index": typeof realtime_index;
  "realtime/presence": typeof realtime_presence;
  "realtime/realtime": typeof realtime_realtime;
  "realtime/realtimeHelpers": typeof realtime_realtimeHelpers;
  "realtime/userEvents": typeof realtime_userEvents;
  realtime: typeof realtime;
  "schemas/agent_schema": typeof schemas_agent_schema;
  "schemas/collaborative_documents_schema": typeof schemas_collaborative_documents_schema;
  "schemas/episodic_memory_schema": typeof schemas_episodic_memory_schema;
  "schemas/memory_schema": typeof schemas_memory_schema;
  "schemas/memory_sharing_schema": typeof schemas_memory_sharing_schema;
  "schemas/notification_schema": typeof schemas_notification_schema;
  search: typeof search;
  "security/applyRateLimit": typeof security_applyRateLimit;
  "security/inputSanitization": typeof security_inputSanitization;
  "security/monitoring": typeof security_monitoring;
  "security/rateLimitedExamples": typeof security_rateLimitedExamples;
  "security/rateLimitedWrapper": typeof security_rateLimitedWrapper;
  "security/rateLimiting": typeof security_rateLimiting;
  "security/rowLevelSecurity": typeof security_rowLevelSecurity;
  "security/secureContractOperations": typeof security_secureContractOperations;
  "security/secureWrapper": typeof security_secureWrapper;
  server: typeof server;
  "shared/agent_types": typeof shared_agent_types;
  "shared/index": typeof shared_index;
  "shared/monitoring": typeof shared_monitoring;
  "shared/notifications": typeof shared_notifications;
  "shared/types": typeof shared_types;
  "types/function_types": typeof types_function_types;
  "types/schema_types": typeof types_schema_types;
  userEvents: typeof userEvents;
  users: typeof users;
  vectorEmbeddings: typeof vectorEmbeddings;
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
