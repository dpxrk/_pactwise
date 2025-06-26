import { GenericId } from 'convex/values';
import { Doc } from '../../../convex/_generated/dataModel';

export interface MockConvexContext {
  db: MockDatabase;
  auth: MockAuth;
  storage: MockStorage;
  scheduler: MockScheduler;
}

export interface MockDatabase {
  query: jest.Mock;
  insert: jest.Mock;
  patch: jest.Mock;
  replace: jest.Mock;
  delete: jest.Mock;
  get: jest.Mock;
  system: {
    query: jest.Mock;
    get: jest.Mock;
  };
}

export interface MockAuth {
  getUserIdentity: jest.Mock;
}

export interface MockStorage {
  getUrl: jest.Mock;
  getMetadata: jest.Mock;
  delete: jest.Mock;
  generateUploadUrl: jest.Mock;
}

export interface MockScheduler {
  runAfter: jest.Mock;
  runAt: jest.Mock;
  cancel: jest.Mock;
}

export function createMockConvexContext(overrides?: Partial<MockConvexContext>): MockConvexContext {
  return {
    db: createMockDatabase(overrides?.db),
    auth: createMockAuth(overrides?.auth),
    storage: createMockStorage(overrides?.storage),
    scheduler: createMockScheduler(overrides?.scheduler),
  };
}

export function createMockDatabase(overrides?: Partial<MockDatabase>): MockDatabase {
  const mockQuery = jest.fn().mockReturnValue({
    filter: jest.fn().mockReturnThis(),
    withIndex: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    take: jest.fn().mockResolvedValue([]),
    first: jest.fn().mockResolvedValue(null),
    unique: jest.fn().mockResolvedValue(null),
    collect: jest.fn().mockResolvedValue([]),
    paginate: jest.fn().mockResolvedValue({ page: [], continueCursor: null }),
  });

  return {
    query: mockQuery,
    insert: jest.fn().mockResolvedValue('mock-id' as GenericId<any>),
    patch: jest.fn().mockResolvedValue(undefined),
    replace: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    system: {
      query: mockQuery,
      get: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

export function createMockAuth(overrides?: Partial<MockAuth>): MockAuth {
  return {
    getUserIdentity: jest.fn().mockResolvedValue({
      subject: 'user123',
      tokenIdentifier: 'token123',
      email: 'test@example.com',
      emailVerified: true,
      name: 'Test User',
      pictureUrl: 'https://example.com/avatar.jpg',
    }),
    ...overrides,
  };
}

export function createMockStorage(overrides?: Partial<MockStorage>): MockStorage {
  return {
    getUrl: jest.fn().mockResolvedValue('https://storage.example.com/file'),
    getMetadata: jest.fn().mockResolvedValue({ size: 1024, contentType: 'application/pdf' }),
    delete: jest.fn().mockResolvedValue(undefined),
    generateUploadUrl: jest.fn().mockResolvedValue('https://upload.example.com/url'),
    ...overrides,
  };
}

export function createMockScheduler(overrides?: Partial<MockScheduler>): MockScheduler {
  return {
    runAfter: jest.fn().mockResolvedValue('scheduled-job-id'),
    runAt: jest.fn().mockResolvedValue('scheduled-job-id'),
    cancel: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<Doc<'users'>>): Doc<'users'> {
  const now = Date.now();
  return {
    _id: 'user123' as GenericId<'users'>,
    _creationTime: now,
    clerkId: 'clerk_user123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    enterpriseId: 'enterprise123' as GenericId<'enterprises'>,
    organizationId: 'org123' as GenericId<'organizations'>,
    lastLogin: now,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockEnterprise(overrides?: Partial<Doc<'enterprises'>>): Doc<'enterprises'> {
  const now = Date.now();
  return {
    _id: 'enterprise123' as GenericId<'enterprises'>,
    _creationTime: now,
    name: 'Test Enterprise',
    industry: 'Technology',
    size: 'medium',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockContract(overrides?: Partial<Doc<'contracts'>>): Doc<'contracts'> {
  const now = Date.now();
  return {
    _id: 'contract123' as GenericId<'contracts'>,
    _creationTime: now,
    title: 'Test Contract',
    contractNumber: 'TEST-001',
    type: 'service',
    status: 'active',
    enterpriseId: 'enterprise123' as GenericId<'enterprises'>,
    vendorId: 'vendor123' as GenericId<'vendors'>,
    value: 50000,
    currency: 'USD',
    startDate: now,
    endDate: now + 365 * 24 * 60 * 60 * 1000, // 1 year later
    createdBy: 'user123' as GenericId<'users'>,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockVendor(overrides?: Partial<Doc<'vendors'>>): Doc<'vendors'> {
  const now = Date.now();
  return {
    _id: 'vendor123' as GenericId<'vendors'>,
    _creationTime: now,
    name: 'Test Vendor',
    legalName: 'Test Vendor Inc.',
    type: 'supplier',
    status: 'active',
    enterpriseId: 'enterprise123' as GenericId<'enterprises'>,
    taxId: '12-3456789',
    email: 'vendor@example.com',
    phone: '+1234567890',
    website: 'https://vendor.example.com',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export async function withMockContext<T>(
  fn: (ctx: MockConvexContext) => Promise<T>,
  contextOverrides?: Partial<MockConvexContext>
): Promise<T> {
  const ctx = createMockConvexContext(contextOverrides);
  return fn(ctx);
}

export function expectToBeId(value: any, tableName?: string) {
  expect(typeof value).toBe('string');
  if (tableName) {
    expect(value).toMatch(new RegExp(`^${tableName}\\|[a-zA-Z0-9]+$`));
  }
}

export function expectToBeTimestamp(value: any) {
  expect(typeof value).toBe('number');
  expect(value).toBeGreaterThan(0);
  expect(value).toBeLessThanOrEqual(Date.now());
}