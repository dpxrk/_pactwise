import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext } from "../security/rowLevelSecurity";
import { api } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";

// Type definitions to avoid deep type instantiation
const templateVariableValidator = v.object({
  name: v.string(),
  type: v.union(v.literal("text"), v.literal("date"), v.literal("number"), v.literal("select")),
  defaultValue: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  required: v.boolean(),
  description: v.optional(v.string()),
});

const templateSectionValidator = v.object({
  id: v.string(),
  title: v.string(),
  content: v.string(),
  isRequired: v.boolean(),
  variables: v.optional(v.array(templateVariableValidator)),
});

const templateMetadataValidator = v.object({
  estimatedValue: v.optional(v.number()),
  typicalDuration: v.optional(v.string()),
  requiredApprovals: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
});

const templateContentValidator = v.object({
  sections: v.array(templateSectionValidator),
  metadata: v.optional(templateMetadataValidator),
});

// Template categories
export const TemplateCategories = {
  GENERAL: "general",
  NDA: "nda",
  SERVICE: "service",
  SALES: "sales",
  EMPLOYMENT: "employment",
  PARTNERSHIP: "partnership",
  LICENSING: "licensing",
  CUSTOM: "custom",
} as const;

export type TemplateCategory = typeof TemplateCategories[keyof typeof TemplateCategories];

// Create contract template
export const createTemplate = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    contractType: v.string(),
    content: templateContentValidator,
    isPublic: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins and managers can create templates
    if (!["owner", "admin", "manager"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Manager access required");
    }

    // Validate category
    const validCategories = Object.values(TemplateCategories);
    if (!validCategories.includes(args.category as TemplateCategory)) {
      throw new ConvexError(`Invalid category: ${args.category}`);
    }

    // Extract all variables from sections
    const allVariables = args.content.sections.flatMap(section => 
      section.variables || []
    );

    const templateId = await ctx.db.insert("contractTemplates", {
      enterpriseId: securityContext.enterpriseId,
      name: args.name,
      description: args.description,
      category: args.category,
      contractType: args.contractType,
      content: args.content,
      variables: allVariables,
      isPublic: args.isPublic || false,
      isActive: true,
      version: 1,
      tags: args.tags || [],
      usageCount: 0,
      createdBy: securityContext.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Log the creation
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "createTemplate",
      resourceType: "contractTemplates",
      resourceId: templateId,
      action: "create",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { name: args.name, category: args.category }
    });

    return { id: templateId };
  },
});

// List templates
export const getTemplates = query({
  args: {
    category: v.optional(v.string()),
    includePublic: v.optional(v.boolean()),
    includeInactive: v.optional(v.boolean()),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args: {
    category?: string;
    includePublic?: boolean;
    includeInactive?: boolean;
    searchTerm?: string;
  }) => {
    const securityContext = await getSecurityContext(ctx);

    let templates = await ctx.db
      .query("contractTemplates")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .collect();

    // Include public templates if requested
    if (args.includePublic) {
      const publicTemplates = await ctx.db
        .query("contractTemplates")
        .withIndex("by_public", (q) => q.eq("isPublic", true))
        .collect();
      
      // Filter out duplicates and templates from same enterprise
      const publicFromOthers = publicTemplates.filter(t => 
        t.enterpriseId !== securityContext.enterpriseId
      );
      
      templates = [...templates, ...publicFromOthers];
    }

    // Apply filters
    if (!args.includeInactive) {
      templates = templates.filter(t => t.isActive);
    }

    if (args.category) {
      templates = templates.filter(t => t.category === args.category);
    }

    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Enrich with creator info
    const enrichedTemplates = await Promise.all(
      templates.map(async (template) => {
        const creator = await ctx.db.get(template.createdBy);
        return {
          ...template,
          creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
          isOwn: template.enterpriseId === securityContext.enterpriseId,
        };
      })
    );

    // Sort by usage count and creation date
    enrichedTemplates.sort((a, b) => {
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });

    return enrichedTemplates;
  },
});

// Get template details
export const getTemplate = query({
  args: {
    templateId: v.id("contractTemplates"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError("Template not found");
    }

    // Check access
    if (template.enterpriseId !== securityContext.enterpriseId && !template.isPublic) {
      throw new ConvexError("Access denied: Template is private");
    }

    // Get version history
    const versions = await ctx.db
      .query("templateVersions")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .order("desc")
      .take(10);

    // Get usage statistics
    const usageStats = await ctx.db
      .query("templateUsage")
      .withIndex("by_template", (q) => q.eq("templateId", args.templateId))
      .collect();

    const creator = await ctx.db.get(template.createdBy);

    return {
      ...template,
      creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
      versions: versions.map(v => ({
        version: v.version,
        createdAt: v.createdAt,
        changes: v.changes,
      })),
      usageStats: {
        total: usageStats.length,
        last30Days: usageStats.filter(u => 
          new Date(u.usedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length,
        averageCompletionTime: calculateAverageCompletionTime(usageStats),
      },
    };
  },
});

// Update template
export const updateTemplate = mutation({
  args: {
    templateId: v.id("contractTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.object({
      sections: v.array(v.object({
        id: v.string(),
        title: v.string(),
        content: v.string(),
        isRequired: v.boolean(),
        variables: v.optional(v.array(v.object({
          name: v.string(),
          type: v.union(v.literal("text"), v.literal("date"), v.literal("number"), v.literal("select")),
          defaultValue: v.optional(v.string()),
          options: v.optional(v.array(v.string())),
          required: v.boolean(),
          description: v.optional(v.string()),
        }))),
      })),
      metadata: v.optional(v.object({
        estimatedValue: v.optional(v.number()),
        typicalDuration: v.optional(v.string()),
        requiredApprovals: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
      })),
    })),
    isPublic: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    changes: v.string(), // Description of changes for version history
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError("Template not found");
    }

    if (template.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Cannot modify templates from other enterprises");
    }

    // Only admins and managers can update templates
    if (!["owner", "admin", "manager"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Manager access required");
    }

    // Save current version before updating
    const newVersion = template.version + 1;
    await ctx.db.insert("templateVersions", {
      templateId: args.templateId,
      version: template.version,
      content: template.content,
      variables: template.variables,
      createdAt: new Date().toISOString(),
      createdBy: securityContext.userId,
      changes: args.changes,
    });

    // Prepare updates
    const updates: any = {
      version: newVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: securityContext.userId,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.content !== undefined) {
      updates.content = args.content;
      // Extract variables from new content
      updates.variables = args.content.sections.flatMap(section => 
        section.variables || []
      );
    }
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.tags !== undefined) updates.tags = args.tags;

    await ctx.db.patch(args.templateId, updates);

    // Log the update
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "updateTemplate",
      resourceType: "contractTemplates",
      resourceId: args.templateId,
      action: "update",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { version: newVersion, changes: args.changes }
    });

    return { success: true, version: newVersion };
  },
});

// Delete template
export const deleteTemplate = mutation({
  args: {
    templateId: v.id("contractTemplates"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError("Template not found");
    }

    if (template.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Cannot delete templates from other enterprises");
    }

    // Only admins can delete templates
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    // Soft delete by marking as inactive
    await ctx.db.patch(args.templateId, {
      isActive: false,
      deletedAt: new Date().toISOString(),
      deletedBy: securityContext.userId,
    });

    // Log the deletion
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "deleteTemplate",
      resourceType: "contractTemplates",
      resourceId: args.templateId,
      action: "delete",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { name: template.name }
    });

    return { success: true };
  },
});

// Use template to create contract
export const useTemplate = action({
  args: {
    templateId: v.id("contractTemplates"),
    variableValues: v.record(v.string(), v.any()),
    contractData: v.object({
      title: v.string(),
      vendorId: v.optional(v.id("vendors")),
      value: v.optional(v.number()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { 
      clerkId: identity.subject 
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get template
    const template = await ctx.runQuery(api.templates.contractTemplates.getTemplate, {
      templateId: args.templateId,
    });

    if (!template) {
      throw new Error("Template not found");
    }

    // Process template content with variables
    const processedContent = processTemplateContent(
      template.content,
      args.variableValues
    );

    // Generate contract document
    const contractContent = generateContractDocument(
      processedContent,
      args.contractData
    );

    // Create contract file (in a real implementation, this would generate a PDF)
    const fileName = `${args.contractData.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    
    // Record template usage
    await ctx.runMutation(api.templates.contractTemplates.recordUsage, {
      templateId: args.templateId,
      contractTitle: args.contractData.title,
      variableValues: args.variableValues,
    });

    // Log the usage
    await ctx.runMutation(api.auditLogging.logEvent, {
      userId: user._id,
      operation: "useTemplate",
      resourceType: "contractTemplates",
      resourceId: args.templateId,
      action: "create",
      status: "success",
      metadata: { contractTitle: args.contractData.title }
    });

    return {
      success: true,
      contractContent,
      fileName,
      message: "Contract draft created from template. Please review and upload the final document.",
    };
  },
});

// Record template usage
export const recordUsage = mutation({
  args: {
    templateId: v.id("contractTemplates"),
    contractTitle: v.string(),
    variableValues: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);

    await ctx.db.insert("templateUsage", {
      templateId: args.templateId,
      enterpriseId: securityContext.enterpriseId,
      userId: securityContext.userId,
      contractTitle: args.contractTitle,
      variableValues: args.variableValues,
      usedAt: new Date().toISOString(),
    });

    // Increment usage count
    const template = await ctx.db.get(args.templateId);
    if (template) {
      await ctx.db.patch(args.templateId, {
        usageCount: template.usageCount + 1,
      });
    }
  },
});

// Clone template
export const cloneTemplate = mutation({
  args: {
    templateId: v.id("contractTemplates"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);

    // Only admins and managers can clone templates
    if (!["owner", "admin", "manager"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Manager access required");
    }

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError("Template not found");
    }

    // Check access
    if (template.enterpriseId !== securityContext.enterpriseId && !template.isPublic) {
      throw new ConvexError("Access denied: Cannot clone private templates from other enterprises");
    }

    const clonedId = await ctx.db.insert("contractTemplates", {
      enterpriseId: securityContext.enterpriseId,
      name: args.newName,
      description: template.description ? `${template.description} (Cloned)` : "Cloned template",
      category: template.category,
      contractType: template.contractType,
      content: template.content,
      variables: template.variables,
      isPublic: false, // Cloned templates start as private
      isActive: true,
      version: 1,
      tags: [...(template.tags || []), "cloned"],
      usageCount: 0,
      createdBy: securityContext.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clonedFrom: args.templateId,
    });

    // Log the cloning
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "cloneTemplate",
      resourceType: "contractTemplates",
      resourceId: clonedId,
      action: "create",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { 
        originalTemplateId: args.templateId,
        originalTemplateName: template.name,
      }
    });

    return { id: clonedId };
  },
});

// Get template categories with counts
export const getTemplateCategories = query({
  args: {},
  handler: async (ctx) => {
    const securityContext = await getSecurityContext(ctx);

    const templates = await ctx.db
      .query("contractTemplates")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .collect();
    
    const activeTemplates = templates.filter(t => t.isActive);

    const categoryCounts = activeTemplates.reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const allCategories = Object.values(TemplateCategories).map(category => ({
      category,
      label: category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '),
      count: categoryCounts[category] || 0,
    }));

    return allCategories;
  },
});

// Helper functions
function calculateAverageCompletionTime(usageStats: any[]): number {
  // In a real implementation, this would calculate time from template use to contract finalization
  return 2.5; // Mock: 2.5 days average
}

function processTemplateContent(
  content: any,
  variableValues: Record<string, any>
): any {
  // Deep clone content
  const processed = JSON.parse(JSON.stringify(content));

  // Replace variables in sections
  processed.sections.forEach((section: any) => {
    section.content = replaceVariables(section.content, variableValues);
  });

  return processed;
}

function replaceVariables(
  text: string,
  values: Record<string, any>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return values[varName] || match;
  });
}

function generateContractDocument(
  content: any,
  contractData: any
): string {
  // In a real implementation, this would generate a proper document
  let document = `# ${contractData.title}\n\n`;
  
  if (contractData.startDate) {
    document += `Start Date: ${contractData.startDate}\n`;
  }
  if (contractData.endDate) {
    document += `End Date: ${contractData.endDate}\n`;
  }
  if (contractData.value) {
    document += `Value: $${contractData.value.toLocaleString()}\n`;
  }
  
  document += '\n---\n\n';

  // Add sections
  content.sections.forEach((section: any) => {
    document += `## ${section.title}\n\n`;
    document += `${section.content}\n\n`;
  });

  return document;
}