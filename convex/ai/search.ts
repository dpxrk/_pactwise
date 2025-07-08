// convex/ai/search.ts
import { query, action, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

// ============================================================================
// AI-POWERED SEARCH
// ============================================================================

// Import OpenAI helpers
import { generateEmbedding, getChatCompletion } from "./openai-config";

/**
 * Search for similar contract clauses using AI
 */
export const searchSimilarClauses = query({
  args: {
    clauseText: v.string(),
    contractId: v.optional(v.id("contracts")),
    threshold: v.optional(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) {
      return [];
    }

    // Get all contracts for the enterprise
    let contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    // Exclude the current contract if specified
    if (args.contractId) {
      contracts = contracts.filter(c => c._id !== args.contractId);
    }

    // Get contract clauses from our clause analysis table
    const contractClauses = await ctx.db
      .query("contractClauses")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    // Group clauses by contract
    const clausesByContract = new Map<string, any[]>();
    contractClauses.forEach(clause => {
      if (!clausesByContract.has(clause.contractId)) {
        clausesByContract.set(clause.contractId, []);
      }
      clausesByContract.get(clause.contractId)!.push(clause);
    });

    // Find similar clauses
    const results: any[] = [];
    const threshold = args.threshold || 0.7;
    const searchText = args.clauseText.toLowerCase();

    // Simple text similarity for now (in production, this would use embeddings)
    for (const [contractId, clauses] of Array.from(clausesByContract)) {
      const contract = contracts.find(c => c._id === contractId);
      if (!contract) continue;

      for (const clause of clauses) {
        if (clause.extractedText) {
          const clauseTextLower = clause.extractedText.toLowerCase();
          
          // Calculate simple similarity score
          const words = searchText.split(' ').filter(w => w.length > 3);
          const matchCount = words.filter(word => clauseTextLower.includes(word)).length;
          const similarity = matchCount / words.length;

          if (similarity >= threshold) {
            results.push({
              contractId: contract._id,
              contractTitle: contract.title,
              clauseType: clause.clauseType,
              clauseText: clause.extractedText,
              similarity: similarity,
              riskLevel: clause.riskLevel,
              metadata: {
                vendor: contract.vendorId,
                value: contract.value,
                startDate: contract.startDate,
                endDate: contract.endDate,
                status: contract.status
              }
            });
          }
        }
      }
    }

    // Sort by similarity and apply limit
    results.sort((a, b) => b.similarity - a.similarity);
    const limit = args.limit || 10;

    return results.slice(0, limit);
  }
});

/**
 * Internal query to get user and clauses for AI search
 */
export const getUserAndClauses = internalQuery({
  args: {
    clerkId: v.string(),
    filters: v.optional(v.object({
      contractType: v.optional(v.array(v.string())),
      clauseType: v.optional(v.array(v.string())),
      riskLevel: v.optional(v.array(v.union(v.literal("low"), v.literal("medium"), v.literal("high")))),
      dateRange: v.optional(v.object({
        start: v.string(),
        end: v.string()
      }))
    }))
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    
    if (!user) {
      return null;
    }

    // Get all contract clauses with embeddings
    const allClauses = await ctx.db
      .query("contractClauses")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    // Apply filters
    let filtered = allClauses;
    
    if (args.filters?.clauseType && args.filters.clauseType.length > 0) {
      filtered = filtered.filter(c => args.filters!.clauseType!.includes(c.clauseType));
    }
    
    if (args.filters?.riskLevel && args.filters.riskLevel.length > 0) {
      filtered = filtered.filter(c => args.filters!.riskLevel!.includes(c.riskLevel));
    }

    return { user, clauses: filtered };
  }
});

/**
 * Internal query to get contract details
 */
export const getContractDetails = internalQuery({
  args: {
    contractId: v.id("contracts")
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contractId);
  }
});

/**
 * Advanced AI-powered clause search using embeddings
 */
export const searchClausesWithAI = action({
  args: {
    query: v.string(),
    filters: v.optional(v.object({
      contractType: v.optional(v.array(v.string())),
      clauseType: v.optional(v.array(v.string())),
      riskLevel: v.optional(v.array(v.union(v.literal("low"), v.literal("medium"), v.literal("high")))),
      dateRange: v.optional(v.object({
        start: v.string(),
        end: v.string()
      }))
    })),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const result = await ctx.runQuery(api.ai.search.getUserAndClauses, {
      clerkId: identity.subject,
      filters: args.filters
    });
    
    if (!result) {
      throw new Error("User not found");
    }
    
    const { user, clauses } = result;

    // Get query embedding
    const queryVector = await generateEmbedding(args.query);

    // Calculate similarities
    const results: any[] = [];
    
    for (const clause of clauses) {
      if (clause.embedding && clause.extractedText) {
        // Calculate cosine similarity
        const similarity = cosineSimilarity(queryVector, clause.embedding);
        
        if (similarity > 0.7) {
          // Get the contract details
          const contract = await ctx.runQuery(api.ai.search.getContractDetails, {
            contractId: clause.contractId as Id<"contracts">
          });

          if (contract) {
            // Apply date range filter if specified
            if (args.filters?.dateRange) {
              const contractDate = new Date(contract.createdAt);
              const startDate = new Date(args.filters.dateRange.start);
              const endDate = new Date(args.filters.dateRange.end);
              
              if (contractDate < startDate || contractDate > endDate) {
                continue;
              }
            }

            // Apply contract type filter if specified
            if (args.filters?.contractType && args.filters.contractType.length > 0) {
              if (!contract.contractType || !args.filters.contractType.includes(contract.contractType)) {
                continue;
              }
            }

            results.push({
              clauseId: clause._id,
              contractId: contract._id,
              contractTitle: contract.title,
              clauseType: clause.clauseType,
              clauseText: clause.extractedText,
              similarity: similarity,
              riskLevel: clause.riskLevel,
              confidence: clause.confidence,
              highlights: await generateHighlights(args.query, clause.extractedText),
              contract: {
                type: contract.contractType,
                vendor: contract.vendorId,
                value: contract.value,
                status: contract.status,
                dates: {
                  start: contract.startDate,
                  end: contract.endDate,
                  created: contract.createdAt
                }
              }
            });
          }
        }
      }
    }

    // Sort by similarity
    results.sort((a, b) => b.similarity - a.similarity);

    // Apply limit
    const limit = args.limit || 20;
    return results.slice(0, limit);
  }
});

/**
 * Internal query to search contracts by criteria
 */
export const searchContractsByCriteria = internalQuery({
  args: {
    clerkId: v.string(),
    criteria: v.object({
      contractTypes: v.optional(v.array(v.string())),
      vendors: v.optional(v.array(v.string())),
      dateRange: v.optional(v.object({
        start: v.optional(v.string()),
        end: v.optional(v.string())
      })),
      valueRange: v.optional(v.object({
        min: v.optional(v.number()),
        max: v.optional(v.number())
      })),
      status: v.optional(v.array(v.string())),
      keywords: v.optional(v.array(v.string())),
      riskLevel: v.optional(v.string())
    })
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    
    if (!user) {
      return null;
    }

    let query = ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId));

    const allContracts = await query.collect();
    
    // Apply filters
    let filtered = allContracts;
    
    if (args.criteria.contractTypes?.length && args.criteria.contractTypes.length > 0) {
      filtered = filtered.filter(c => c.contractType && args.criteria.contractTypes!.includes(c.contractType));
    }
    
    if (args.criteria.status?.length && args.criteria.status.length > 0) {
      filtered = filtered.filter(c => args.criteria.status!.includes(c.status));
    }
    
    if (args.criteria.valueRange?.min !== null && args.criteria.valueRange?.min !== undefined) {
      filtered = filtered.filter(c => c.value && c.value >= args.criteria.valueRange!.min!);
    }
    
    if (args.criteria.valueRange?.max !== null && args.criteria.valueRange?.max !== undefined) {
      filtered = filtered.filter(c => c.value && c.value <= args.criteria.valueRange!.max!);
    }
    
    if (args.criteria.dateRange?.start) {
      filtered = filtered.filter(c => c.startDate && new Date(c.startDate) >= new Date(args.criteria.dateRange!.start!));
    }
    
    if (args.criteria.dateRange?.end) {
      filtered = filtered.filter(c => c.endDate && new Date(c.endDate) <= new Date(args.criteria.dateRange!.end!));
    }
    
    // Keyword search
    if (args.criteria.keywords?.length && args.criteria.keywords.length > 0) {
      filtered = filtered.filter(c => {
        const searchText = `${c.title} ${c.notes || ""} ${c.extractedScope || ""}`.toLowerCase();
        return args.criteria.keywords!.some((keyword: string) => searchText.includes(keyword.toLowerCase()));
      });
    }

    return { user, contracts: filtered };
  }
});

/**
 * Search contracts using natural language
 */
export const searchContractsNL = action({
  args: {
    query: v.string(),
    includeAnalysis: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    // First check if user exists
    const userCheck = await ctx.runQuery(api.ai.search.getUserAndClauses, {
      clerkId: identity.subject
    });
    
    if (!userCheck) {
      throw new Error("User not found");
    }

    // Parse the natural language query
    const parsePrompt = `Parse this contract search query and extract search criteria:
"${args.query}"

Extract and return in JSON format:
{
  "contractTypes": [],
  "vendors": [],
  "dateRange": { "start": null, "end": null },
  "valueRange": { "min": null, "max": null },
  "status": [],
  "keywords": [],
  "riskLevel": null
}`;

    try {
      const messages = [
        {
          role: "system",
          content: "You are a search query parser. Extract search criteria from natural language queries."
        },
        {
          role: "user",
          content: parsePrompt
        }
      ];

      const content = await getChatCompletion(messages, {
        model: "gpt-4-1106-preview",
        temperature: 0.1,
        max_tokens: 500
      });
      
      if (!content) {
        throw new Error("No response from query parser");
      }

      const criteria = JSON.parse(content);

      // Search contracts based on criteria
      const result = await ctx.runQuery(api.ai.search.searchContractsByCriteria, {
        clerkId: identity.subject,
        criteria
      });
      
      if (!result) {
        throw new Error("Unable to search contracts");
      }
      
      const { contracts } = result;

      // Include AI analysis if requested
      if (args.includeAnalysis && contracts.length > 0) {
        const analysisPrompt = `Based on this search query: "${args.query}"
And these ${contracts.length} contracts found, provide a brief analysis:
- Key findings
- Potential risks or opportunities
- Recommendations

Keep it concise (3-4 sentences).`;

        const analysisMessages = [
          {
            role: "system",
            content: "You are a contract analysis expert providing concise insights."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ];

        const analysis = await getChatCompletion(analysisMessages, {
          model: "gpt-4-1106-preview",
          temperature: 0.7,
          max_tokens: 300
        }) || "";

        return {
          contracts: contracts.slice(0, 20), // Limit results
          searchCriteria: criteria,
          totalFound: contracts.length,
          analysis
        };
      }

      return {
        contracts: contracts.slice(0, 20),
        searchCriteria: criteria,
        totalFound: contracts.length
      };

    } catch (error) {
      console.error("Natural language search failed:", error);
      
      // Fallback to simple keyword search
      const fallbackResult = await ctx.runQuery(api.ai.search.searchContractsByCriteria, {
        clerkId: identity.subject,
        criteria: { keywords: [args.query] }
      });
      
      if (!fallbackResult) {
        throw new Error("Unable to search contracts");
      }
      
      const contracts = fallbackResult.contracts;

      return {
        contracts: contracts.slice(0, 20),
        searchCriteria: { keywords: [args.query] },
        totalFound: contracts.length
      };
    }
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i]! * vec2[i]!;
    norm1 += vec1[i]! * vec1[i]!;
    norm2 += vec2[i]! * vec2[i]!;
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

async function generateHighlights(query: string, text: string): Promise<string[]> {
  const words = query.toLowerCase().split(' ').filter(w => w.length > 2);
  const sentences = text.split(/[.!?]+/);
  const highlights: string[] = [];

  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    const matchCount = words.filter(word => sentenceLower.includes(word)).length;
    
    if (matchCount >= Math.ceil(words.length / 2)) {
      highlights.push(sentence.trim());
    }
  }

  return highlights.slice(0, 3);
}