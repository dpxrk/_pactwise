// convex/ai/contractAnalyzer.ts
import { action } from "../_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";

// ============================================================================
// AI CONTRACT ANALYZER
// ============================================================================

interface ClauseAnalysisResult {
  clauseType: string;
  present: boolean;
  confidence: number;
  extractedText?: string;
  riskLevel: "low" | "medium" | "high";
  recommendations: string[];
}

interface ContractAnalysisResult {
  clauses: ClauseAnalysisResult[];
  overallRiskScore: number;
  criticalIssues: string[];
  recommendations: string[];
}

// Standard contract clauses to analyze
const STANDARD_CLAUSES = [
  "termination",
  "indemnification", 
  "limitation_of_liability",
  "confidentiality",
  "intellectual_property",
  "payment_terms",
  "dispute_resolution",
  "force_majeure",
  "governing_law",
  "warranties",
  "data_protection",
  "compliance"
];

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  return new OpenAI({ apiKey });
};

/**
 * Analyze contract text for specific clauses using AI/NLP
 */
export const analyzeContractClauses = action({
  args: {
    contractText: v.string(),
    requiredClauses: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args): Promise<ContractAnalysisResult> => {
    const requiredClauses = args.requiredClauses || STANDARD_CLAUSES;
    const contractText = args.contractText;
    const openai = getOpenAIClient();

    // Prepare the prompt for clause analysis
    const prompt = `
You are a legal contract analysis expert. Analyze the following contract text and identify the presence, quality, and risk level of specific clauses.

Contract Text:
"""
${contractText}
"""

Required Clauses to Analyze:
${requiredClauses.map(clause => `- ${clause}`).join('\n')}

For each clause, provide:
1. Whether it's present (true/false)
2. Confidence level (0-1)
3. Extracted relevant text (if present)
4. Risk level (low/medium/high)
5. Specific recommendations

Also provide:
- Overall contract risk score (0-100)
- Critical issues that need immediate attention
- General recommendations for improvement

Respond in valid JSON format:
{
  "clauses": [
    {
      "clauseType": "termination",
      "present": true,
      "confidence": 0.95,
      "extractedText": "relevant clause text...",
      "riskLevel": "medium",
      "recommendations": ["specific recommendation"]
    }
  ],
  "overallRiskScore": 65,
  "criticalIssues": ["issue 1", "issue 2"],
  "recommendations": ["general recommendation"]
}
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [
          {
            role: "system",
            content: "You are a legal expert specializing in contract analysis. Always respond with valid JSON format."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      // Parse the JSON response
      const analysis: ContractAnalysisResult = JSON.parse(content);
      
      // Validate the response structure
      if (!analysis.clauses || !Array.isArray(analysis.clauses)) {
        throw new Error("Invalid response structure from AI analysis");
      }

      return analysis;

    } catch (error) {
      console.error("AI contract analysis failed:", error);
      
      // Fallback to basic analysis if AI fails
      return fallbackClauseAnalysis(contractText, requiredClauses);
    }
  }
});

/**
 * Semantic similarity search for clause matching
 */
export const findSimilarClauses = action({
  args: {
    clauseText: v.string(),
    contractText: v.string(),
    threshold: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<{ text: string; similarity: number }[]> => {
    const { clauseText, contractText, threshold = 0.7 } = args;
    const openai = getOpenAIClient();

    try {
      // Get embeddings for the clause and contract sections
      const clauseEmbedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: clauseText
      });

      // Split contract into sections for analysis
      const sections = contractText.split('\n\n').filter(section => section.trim().length > 50);
      const sectionEmbeddings = await Promise.all(
        sections.map(async (section) => {
          const embedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: section
          });
          return { text: section, embedding: embedding.data[0]!.embedding };
        })
      );

      // Calculate similarities
      const clauseVector = clauseEmbedding.data[0]!.embedding;
      const similarities = sectionEmbeddings.map(({ text, embedding }) => ({
        text,
        similarity: cosineSimilarity(clauseVector, embedding)
      }));

      // Return sections above threshold, sorted by similarity
      return similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

    } catch (error) {
      console.error("Semantic similarity analysis failed:", error);
      return [];
    }
  }
});

/**
 * AI-powered risk assessment for contract clauses
 */
export const assessClauseRisk = action({
  args: {
    clauseText: v.string(),
    clauseType: v.string()
  },
  handler: async (ctx, args): Promise<{
    riskScore: number;
    riskFactors: string[];
    mitigationStrategies: string[];
  }> => {
    const { clauseText, clauseType } = args;
    const openai = getOpenAIClient();

    const prompt = `
Analyze the following ${clauseType} clause for legal and business risks:

Clause Text:
"""
${clauseText}
"""

Provide a risk assessment including:
1. Risk score (0-100, where 100 is highest risk)
2. Specific risk factors identified
3. Mitigation strategies

Respond in JSON format:
{
  "riskScore": 75,
  "riskFactors": ["factor 1", "factor 2"],
  "mitigationStrategies": ["strategy 1", "strategy 2"]
}
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [
          {
            role: "system",
            content: "You are a legal risk assessment expert. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from risk assessment");
      }

      return JSON.parse(content);

    } catch (error) {
      console.error("Risk assessment failed:", error);
      
      // Fallback risk assessment
      return {
        riskScore: 50,
        riskFactors: ["Unable to perform AI risk assessment"],
        mitigationStrategies: ["Manual legal review recommended"]
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

/**
 * Fallback analysis when AI is unavailable
 */
function fallbackClauseAnalysis(
  contractText: string,
  requiredClauses: string[]
): ContractAnalysisResult {
  const text = contractText.toLowerCase();
  const clauses: ClauseAnalysisResult[] = requiredClauses.map(clauseType => {
    const keywords = getClauseKeywords(clauseType);
    const present = keywords.some(keyword => text.includes(keyword.toLowerCase()));
    
    return {
      clauseType,
      present,
      confidence: present ? 0.6 : 0.1, // Lower confidence for keyword matching
      riskLevel: present ? "low" : "high",
      recommendations: present 
        ? ["Review clause for completeness"] 
        : [`Add ${clauseType} clause to contract`]
    };
  });

  const missingCritical = clauses.filter(c => !c.present && isCriticalClause(c.clauseType));
  
  return {
    clauses,
    overallRiskScore: missingCritical.length * 20 + (clauses.filter(c => !c.present).length * 5),
    criticalIssues: missingCritical.map(c => `Missing critical ${c.clauseType} clause`),
    recommendations: [
      "AI analysis unavailable - manual legal review recommended",
      ...missingCritical.map(c => `Add ${c.clauseType} clause`)
    ]
  };
}

function getClauseKeywords(clauseType: string): string[] {
  const keywordMap: Record<string, string[]> = {
    termination: ["terminate", "termination", "end", "expiry", "expire"],
    indemnification: ["indemnify", "indemnification", "hold harmless", "defend"],
    limitation_of_liability: ["liability", "limitation", "exclude", "damages"],
    confidentiality: ["confidential", "non-disclosure", "proprietary", "confidentiality"],
    intellectual_property: ["intellectual property", "copyright", "trademark", "patent"],
    payment_terms: ["payment", "invoice", "due", "terms", "billing"],
    dispute_resolution: ["dispute", "arbitration", "mediation", "litigation"],
    force_majeure: ["force majeure", "act of god", "unforeseeable"],
    governing_law: ["governing law", "jurisdiction", "applicable law"],
    warranties: ["warranty", "warrants", "guarantee", "representation"],
    data_protection: ["data protection", "privacy", "GDPR", "personal data"],
    compliance: ["compliance", "regulatory", "laws", "regulations"]
  };
  
  return keywordMap[clauseType] || [clauseType];
}

function isCriticalClause(clauseType: string): boolean {
  const criticalClauses = [
    "termination",
    "indemnification", 
    "limitation_of_liability",
    "governing_law",
    "data_protection"
  ];
  return criticalClauses.includes(clauseType);
}