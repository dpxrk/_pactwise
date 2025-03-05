import { defineSchema, defineTable } from "convex/schema";
import { v } from "convex/values";

export default defineSchema({
  contractRevisions: defineTable({
    contractId: v.id("contracts"),
    version: v.number(),
    changesSummary: v.string(),
    createdById: v.id("users"),
    createdAt: v.string(),
  }).index("by_contract", ["contractId"]),
  
  signatures: defineTable({
    contractId: v.id("contracts"),
    signerEmail: v.string(),
    status: v.string(),
  }).index("by_contract", ["contractId"]),
  
  contractApprovers: defineTable({
    contractId: v.id("contracts"),
    userId: v.id("users"),
    approvalStatus: v.string(),
  }).index("by_contract", ["contractId"]),
  
  contracts: defineTable({
    enterpriseId: v.id("enterprises"),
    title: v.string(),
    status: v.string(),
  }).index("by_enterprise", ["enterpriseId"]),
}); 