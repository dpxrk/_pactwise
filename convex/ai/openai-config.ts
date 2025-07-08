// convex/ai/openai-config.ts
import { action } from "../_generated/server";

// Initialize OpenAI client
// Note: OpenAI should only be imported inside action handlers
export async function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }
  
  // Dynamic import to avoid bundling issues
  const { default: OpenAI } = await import("openai");
  
  return new OpenAI({
    apiKey,
  });
}

// Helper function to generate embeddings
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = await getOpenAI();
  
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  
  return response.data[0].embedding;
}

// Helper function for chat completions
export async function getChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
) {
  const openai = await getOpenAI();
  
  const response = await openai.chat.completions.create({
    model: options?.model || "gpt-4-turbo-preview",
    messages: messages as any,
    temperature: options?.temperature || 0.7,
    max_tokens: options?.max_tokens || 1000,
  });
  
  return response.choices[0].message.content;
}