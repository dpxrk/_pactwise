import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { api } from '../../../convex/_generated/api';
import schema from '../../../convex/schema';

export const mockRuntime = () => convexTest(schema);

// Helper to create authenticated context
export async function createAuthenticatedContext(t: any, userId?: string) {
  const actualUserId = userId || 'user123';
  
  return t.withIdentity({
    subject: actualUserId,
    tokenIdentifier: `token_${actualUserId}`,
    email: `${actualUserId}@example.com`,
    emailVerified: true,
    name: 'Test User',
    pictureUrl: 'https://example.com/avatar.jpg'
  });
}

// Helper to seed test data
export async function seedTestData(t: any) {
  const ctx = await createAuthenticatedContext(t);
  
  // Create enterprise
  const enterpriseId = await ctx.db.insert('enterprises', {
    name: 'Test Enterprise',
    industry: 'Technology',
    size: 'medium',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  // Create organization
  const organizationId = await ctx.db.insert('organizations', {
    name: 'Test Organization',
    enterpriseId,
    type: 'department',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  // Create user
  const userId = await ctx.db.insert('users', {
    clerkId: 'clerk_user123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    enterpriseId,
    organizationId,
    lastLogin: Date.now(),
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  // Create vendor
  const vendorId = await ctx.db.insert('vendors', {
    name: 'Test Vendor',
    legalName: 'Test Vendor Inc.',
    type: 'supplier',
    status: 'active',
    enterpriseId,
    taxId: '12-3456789',
    email: 'vendor@example.com',
    phone: '+1234567890',
    website: 'https://vendor.example.com',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  // Create contract
  const contractId = await ctx.db.insert('contracts', {
    title: 'Test Contract',
    contractNumber: 'TEST-001',
    type: 'service',
    status: 'active',
    enterpriseId,
    vendorId,
    value: 50000,
    currency: 'USD',
    startDate: Date.now(),
    endDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
    createdBy: userId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  return {
    enterpriseId,
    organizationId,
    userId,
    vendorId,
    contractId
  };
}

// Helper for testing error cases
export function expectConvexError(fn: () => Promise<any>, expectedMessage: string | RegExp) {
  return expect(fn()).rejects.toThrow(expectedMessage);
}

// Helper for testing paginated results
export async function collectPaginatedResults<T>(
  query: any,
  args: any = {}
): Promise<T[]> {
  const results: T[] = [];
  let continueCursor = undefined;
  
  do {
    const page = await query({ ...args, paginationOpts: { numItems: 10, cursor: continueCursor } });
    results.push(...page.page);
    continueCursor = page.continueCursor;
  } while (continueCursor);
  
  return results;
}

// Mock external services
export const mockOpenAI = () => {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mocked AI response',
              role: 'assistant'
            }
          }]
        })
      }
    }
  };
};

// Mock Clerk
export const mockClerk = () => {
  return {
    users: {
      getUser: vi.fn().mockResolvedValue({
        id: 'clerk_user123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://example.com/avatar.jpg'
      })
    }
  };
};