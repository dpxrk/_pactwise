/**
 * Convex context types to replace 'any' usage in agent and backend files
 */

import { Id, Doc, TableNames } from '../../convex/_generated/dataModel';
import { GenericDatabaseReader, GenericDatabaseWriter } from 'convex/server';
import { DataModel } from '../../convex/_generated/dataModel';

// Use Convex's built-in database types directly
export type TypedDatabaseReader = GenericDatabaseReader<DataModel>;
export type TypedDatabaseWriter = GenericDatabaseWriter<DataModel>;

// Database interface using Convex types
export interface TypedDatabase extends TypedDatabaseWriter {
  // TypedDatabaseWriter already includes all database operations
}

// Auth interface with proper typing
export interface TypedAuth {
  getUserIdentity: () => Promise<{
    tokenIdentifier: string;
    name?: string;
    email?: string;
    pictureUrl?: string;
    subject?: string;
    issuer?: string;
  } | null>;
}

// Storage interface
export interface TypedStorage {
  generateUploadUrl: () => Promise<string>;
  getUrl: (storageId: Id<"_storage">) => Promise<string | null>;
  delete: (storageId: Id<"_storage">) => Promise<void>;
}

// Scheduler interface
export interface TypedScheduler {
  runAfter: <FuncName extends string>(
    delayMs: number,
    functionName: FuncName,
    args: unknown
  ) => Promise<Id<"_scheduled_functions">>;
  runAt: <FuncName extends string>(
    timestamp: number,
    functionName: FuncName,
    args: unknown
  ) => Promise<Id<"_scheduled_functions">>;
  cancel: (id: Id<"_scheduled_functions">) => Promise<void>;
}

// Query context
export interface TypedQueryCtx {
  db: TypedDatabaseReader;
  auth: TypedAuth;
}

// Mutation context
export interface TypedMutationCtx {
  db: TypedDatabaseWriter;
  auth: TypedAuth;
  storage: TypedStorage;
  scheduler: TypedScheduler;
}

// Action context
export interface TypedActionCtx {
  auth: TypedAuth;
  scheduler: TypedScheduler;
  runQuery: <FuncName extends string>(
    functionName: FuncName,
    args: unknown
  ) => Promise<unknown>;
  runMutation: <FuncName extends string>(
    functionName: FuncName,
    args: unknown
  ) => Promise<unknown>;
}

// Agent specific contexts
export interface AgentQueryCtx {
  db: TypedDatabaseReader;
  auth: TypedAuth;
}

export interface AgentMutationCtx {
  db: TypedDatabaseWriter;
  auth: TypedAuth;
  storage: TypedStorage;
  scheduler: TypedScheduler;
}

// Helper type for patch data
export type PatchData<T extends TableNames> = Partial<Omit<Doc<T>, "_id" | "_creationTime">>;

// Helper type for insert data
export type InsertData<T extends TableNames> = Omit<Doc<T>, "_id" | "_creationTime">;

// Type guard for checking if a value is a valid Id
export function isValidId<T extends TableNames>(
  value: unknown,
  table: T
): value is Id<T> {
  return typeof value === "string" && value.startsWith(`${table}|`);
}