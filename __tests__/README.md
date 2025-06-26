# Pactwise Test Suite

This directory contains comprehensive tests for the Pactwise application, covering both backend and frontend functionality.

## Directory Structure

```
__tests__/
├── backend/
│   ├── core/           # Core business logic tests
│   │   ├── contracts.test.ts
│   │   ├── contracts-analysis.test.ts
│   │   ├── vendors.test.ts
│   │   ├── users.test.ts
│   │   └── enterprises.test.ts
│   ├── agents/         # AI agent tests
│   ├── features/       # Feature-specific tests
│   ├── security/       # Security and auth tests
│   ├── realtime/       # Real-time feature tests
│   ├── utils/          # Test utilities
│   └── mocks/          # Mock implementations
├── frontend/           # Frontend component tests
└── setup.ts           # Test environment setup
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only backend tests
npm run test:backend

# Run only frontend tests
npm run test:frontend

# Run tests in CI mode
npm run test:ci
```

## Test Coverage Goals

- **Minimum Coverage**: 80% overall
- **Critical Paths**: 95% coverage for authentication, contracts, and vendor management
- **Edge Cases**: Comprehensive testing of error scenarios and boundary conditions

## Writing Tests

### Backend Tests

Backend tests use mock Convex contexts to simulate database operations:

```typescript
import { withMockContext } from '../utils/convex-test-helpers';

describe('Feature', () => {
  it('should handle operation', async () => {
    await withMockContext(async (ctx) => {
      // Setup mocks
      ctx.auth.getUserIdentity.mockResolvedValue({...});
      ctx.db.query().filter().first.mockResolvedValue({...});
      
      // Execute test
      const result = await simulateFunction(ctx, args);
      
      // Assert expectations
      expect(result).toBe(expected);
    });
  });
});
```

### Key Testing Patterns

1. **Authentication Tests**: Always verify user authentication and authorization
2. **Multi-tenancy Tests**: Ensure enterprise isolation is maintained
3. **Validation Tests**: Check input validation and sanitization
4. **Error Handling**: Test error scenarios and edge cases
5. **Performance Tests**: Verify pagination and query optimization

### Mock Helpers

The test suite provides several mock helpers:

- `createMockUser()`: Creates a mock user with customizable properties
- `createMockContract()`: Creates a mock contract
- `createMockVendor()`: Creates a mock vendor
- `createMockEnterprise()`: Creates a mock enterprise
- `createMockConvexContext()`: Creates a complete mock Convex context

## Test Categories

### 1. Unit Tests
- Individual function testing
- Business logic validation
- Data transformation tests

### 2. Integration Tests
- Multi-function workflows
- Agent coordination tests
- Real-time event handling

### 3. Security Tests
- Authentication flows
- Authorization checks
- Input sanitization
- XSS prevention

### 4. Performance Tests
- Query optimization
- Pagination handling
- Bulk operations

## CI/CD Integration

Tests are automatically run on:
- Pull request creation
- Commits to main branch
- Pre-deployment validation

## Debugging Tests

To debug a specific test:

```bash
# Run a single test file
npm test contracts.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should create contract"

# Run with verbose output
npm test -- --verbose
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Descriptions**: Use descriptive test names
3. **Arrange-Act-Assert**: Follow AAA pattern
4. **Mock External Services**: Don't make real API calls
5. **Test Edge Cases**: Include boundary and error conditions
6. **Keep Tests Fast**: Optimize for quick execution
7. **Maintain Tests**: Update tests when features change

## Common Issues

### Test Timeout
If tests timeout, increase the timeout in jest.config.js or specific tests:
```typescript
it('should handle long operation', async () => {
  // test code
}, 30000); // 30 second timeout
```

### Mock Reset
Ensure mocks are properly reset between tests using `afterEach`:
```typescript
afterEach(() => {
  jest.clearAllMocks();
});
```

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this README if needed