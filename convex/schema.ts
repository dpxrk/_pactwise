import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const contractStatusOptions = [
  "draft", "pending_analysis", "active", "expired", "terminated", "archived",
] as const;

const analysisStatusOptions = [
    "pending", "processing", "completed", "failed",
] as const;

export default defineSchema({
  // ===== ENTERPRISES (NEW TABLE) =====
  // Stores basic information about enterprises/organizations.
  enterprises: defineTable({
    name: v.string(), // Name of the enterprise
    // Add any other relevant enterprise fields, e.g., domain, ownerUserId (Clerk's user ID)
    // For now, just a name is enough to link contracts.
  })
  .index("by_name", ["name"]), // Optional: index by name

  // ===== VENDORS =====
  vendors: defineTable({
    name: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),
    // --- ADD enterpriseId to vendors as well if vendors are enterprise-specific ---
    // enterpriseId: v.optional(v.id("enterprises")),
  })
  .index("by_name", ["name"]),
  // .index("by_enterprise", ["enterpriseId"]), // If you add enterpriseId to vendors

  // ===== CONTRACTS =====
  contracts: defineTable({
    // --- ADD enterpriseId field ---
    enterpriseId: v.id("enterprises"), // Required: Links to the 'enterprises' table

    vendorId: v.id("vendors"),
    title: v.string(),
    status: v.union(
        v.literal(contractStatusOptions[0]), v.literal(contractStatusOptions[1]),
        v.literal(contractStatusOptions[2]), v.literal(contractStatusOptions[3]),
        v.literal(contractStatusOptions[4]), v.literal(contractStatusOptions[5]),
    ),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    extractedParties: v.optional(v.array(v.string())),
    extractedStartDate: v.optional(v.string()),
    extractedEndDate: v.optional(v.string()),
    extractedPaymentSchedule: v.optional(v.string()),
    extractedPricing: v.optional(v.string()),
    extractedScope: v.optional(v.string()),
    analysisStatus: v.optional(v.union(
        v.literal(analysisStatusOptions[0]), v.literal(analysisStatusOptions[1]),
        v.literal(analysisStatusOptions[2]), v.literal(analysisStatusOptions[3]),
    )),
    analysisError: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
  .index("by_vendorId", ["vendorId"])
  .index("by_status", ["status"])
  .index("by_analysisStatus", ["analysisStatus"])
  // --- ADD index for querying by enterpriseId ---
  .index("by_enterpriseId", ["enterpriseId"]),
});