# Schema Type Migration Guide

This guide shows how to replace all `v.any()` and `v.unknown()` usages with proper TypeScript types from `schema-types.ts`.

## 1. Update convex/schema.ts

### userOnboarding table
```typescript
// OLD:
metadata: v.optional(v.any()),

// NEW:
import { convexSchemas } from './types/schema-types';
metadata: v.optional(convexSchemas.onboardingMetadata),
```

### analytics_events table
```typescript
// OLD:
properties: v.optional(v.any()),

// NEW:
properties: v.optional(convexSchemas.analyticsEventProperties),
```

### error_reports table
```typescript
// OLD:
context: v.optional(v.any()),

// NEW:
import { convexSchemas } from './types/schema-types';
context: v.optional(v.object({
  componentName: v.optional(v.string()),
  componentProps: v.optional(v.record(v.string(), v.any())), // Still uses v.any() for flexibility
  componentState: v.optional(v.record(v.string(), v.any())),
  apiEndpoint: v.optional(v.string()),
  apiMethod: v.optional(v.string()),
  apiParams: v.optional(v.record(v.string(), v.any())),
  apiHeaders: v.optional(v.record(v.string(), v.string())),
  userRole: v.optional(v.string()),
  userPermissions: v.optional(v.array(v.string())),
  enterpriseSettings: v.optional(v.record(v.string(), v.any())),
  environment: v.optional(v.string()),
  buildVersion: v.optional(v.string()),
  features: v.optional(v.array(v.string())),
})),
```

### realtimeEvents table
```typescript
// OLD:
data: v.optional(v.any()),

// NEW:
data: v.optional(v.object({
  contract: v.optional(v.object({
    id: v.string(),
    title: v.string(),
    vendorId: v.string(),
    vendorName: v.string(),
    status: v.string(),
    previousStatus: v.optional(v.string()),
    updatedFields: v.optional(v.array(v.string())),
  })),
  vendor: v.optional(v.object({
    id: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    contractCount: v.optional(v.number()),
  })),
  analysis: v.optional(v.object({
    contractId: v.string(),
    contractTitle: v.string(),
    analysisType: v.string(),
    insights: v.optional(v.array(v.object({
      type: v.string(),
      severity: v.string(),
      message: v.string(),
    }))),
    completedAt: v.string(),
  })),
  notification: v.optional(v.object({
    id: v.string(),
    type: v.string(),
    priority: v.string(),
    title: v.string(),
    message: v.string(),
  })),
  user: v.optional(v.object({
    id: v.string(),
    name: v.string(),
    email: v.string(),
    action: v.string(),
  })),
  system: v.optional(v.object({
    alertType: v.string(),
    severity: v.string(),
    message: v.string(),
    affectedResources: v.optional(v.array(v.string())),
  })),
})),
```

### user_events table
```typescript
// OLD:
properties: v.optional(v.any()),

// NEW:
properties: v.optional(convexSchemas.analyticsEventProperties),
```

## 2. Update convex/agent_schema.ts

### agentSystem table
```typescript
// OLD:
config: v.optional(v.any()),
metrics: v.optional(v.any()),

// NEW:
config: v.optional(v.object({
  maxConcurrentTasks: v.number(),
  taskTimeoutMinutes: v.number(),
  logRetentionDays: v.number(),
  insightRetentionDays: v.optional(v.number()),
  healthCheckIntervalMinutes: v.optional(v.number()),
  autoRestartOnFailure: v.optional(v.boolean()),
  maxRetryAttempts: v.optional(v.number()),
  enabledFeatures: v.optional(v.array(v.string())),
  notifications: v.optional(v.object({
    emailEnabled: v.boolean(),
    slackEnabled: v.boolean(),
    webhookEnabled: v.boolean(),
  })),
})),
metrics: v.optional(v.object({
  totalTasksProcessed: v.number(),
  totalInsightsGenerated: v.number(),
  systemUptime: v.number(),
  averageTaskDuration: v.optional(v.number()),
  errorRate: v.optional(v.number()),
  lastHealthCheck: v.optional(v.string()),
  performanceScore: v.optional(v.number()),
})),
```

### agents table
```typescript
// OLD:
config: v.optional(v.any()),
metrics: v.optional(v.any()),

// NEW:
config: v.optional(v.object({
  runIntervalMinutes: v.optional(v.number()),
  retryAttempts: v.optional(v.number()),
  timeoutMinutes: v.optional(v.number()),
  enabled: v.optional(v.boolean()),
  priority: v.optional(v.union(
    v.literal("low"),
    v.literal("medium"),
    v.literal("high"),
    v.literal("critical")
  )),
  dependencies: v.optional(v.array(v.id("agents"))),
  // For agent-specific configs, use a discriminated union or separate fields
  secretaryConfig: v.optional(v.object({
    supportedFileTypes: v.array(v.string()),
    maxFileSize: v.number(),
    ocrEnabled: v.boolean(),
    languageDetection: v.boolean(),
  })),
  financialConfig: v.optional(v.object({
    currencyConversion: v.boolean(),
    taxCalculation: v.boolean(),
    budgetThresholds: v.record(v.string(), v.number()),
    costCenters: v.array(v.string()),
  })),
  // ... other agent configs
})),
metrics: v.optional(v.object({
  totalRuns: v.number(),
  successfulRuns: v.number(),
  failedRuns: v.number(),
  averageRunTime: v.number(),
  lastRunDuration: v.optional(v.number()),
  dataProcessed: v.optional(v.number()),
  insightsGenerated: v.optional(v.number()),
})),
```

### agentInsights table
```typescript
// OLD:
data: v.optional(v.any()),

// NEW:
data: v.optional(v.object({
  financial: v.optional(v.object({
    totalSpend: v.number(),
    projectedSpend: v.number(),
    savingsOpportunity: v.number(),
    currency: v.string(),
    breakdown: v.array(v.object({
      category: v.string(),
      amount: v.number(),
      percentage: v.number(),
    })),
  })),
  risk: v.optional(v.object({
    riskScore: v.number(),
    riskFactors: v.array(v.object({
      factor: v.string(),
      severity: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical")
      ),
      description: v.string(),
      mitigation: v.string(),
    })),
    complianceIssues: v.array(v.string()),
  })),
  contract: v.optional(v.object({
    keyTerms: v.record(v.string(), v.string()),
    missingClauses: v.array(v.string()),
    unusualTerms: v.array(v.string()),
    negotiationPoints: v.array(v.string()),
    expirationRisk: v.boolean(),
  })),
  vendor: v.optional(v.object({
    performanceScore: v.number(),
    contractCount: v.number(),
    totalValue: v.number(),
    riskIndicators: v.array(v.string()),
    alternativeVendors: v.array(v.object({
      id: v.string(),
      name: v.string(),
      matchScore: v.number(),
    })),
  })),
  recommendations: v.optional(v.array(v.object({
    action: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    impact: v.string(),
    effort: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    deadline: v.optional(v.string()),
  }))),
})),
```

### agentTasks table
```typescript
// OLD:
data: v.optional(v.any()),
result: v.optional(v.any()),

// NEW:
data: v.optional(v.object({
  input: v.optional(v.object({
    contractId: v.optional(v.string()),
    vendorId: v.optional(v.string()),
    fileId: v.optional(v.string()),
    query: v.optional(v.string()),
    filters: v.optional(v.record(v.string(), v.any())),
    options: v.optional(v.record(v.string(), v.any())),
  })),
  config: v.optional(v.object({
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    maxRetries: v.number(),
    timeoutMinutes: v.number(),
    dependencies: v.array(v.string()),
    notifyOnComplete: v.boolean(),
  })),
  context: v.optional(v.object({
    triggeredBy: v.string(),
    reason: v.string(),
    relatedTasks: v.array(v.string()),
    parentTaskId: v.optional(v.string()),
  })),
})),
result: v.optional(v.object({
  success: v.optional(v.object({
    data: v.record(v.string(), v.any()),
    insights: v.optional(v.any()), // Reference to AgentInsightData structure
    nextSteps: v.optional(v.array(v.string())),
    metrics: v.optional(v.object({
      processingTime: v.number(),
      recordsProcessed: v.number(),
      confidence: v.number(),
    })),
  })),
  error: v.optional(v.object({
    code: v.string(),
    message: v.string(),
    details: v.record(v.string(), v.any()),
    retryable: v.boolean(),
    suggestion: v.optional(v.string()),
  })),
  partial: v.optional(v.object({
    progress: v.number(),
    completed: v.array(v.string()),
    remaining: v.array(v.string()),
    estimatedCompletion: v.string(),
  })),
})),
```

### agentLogs table
```typescript
// OLD:
data: v.optional(v.any()),

// NEW:
data: v.optional(v.object({
  action: v.optional(v.string()),
  resource: v.optional(v.object({
    type: v.string(),
    id: v.string(),
    name: v.optional(v.string()),
  })),
  performance: v.optional(v.object({
    duration: v.number(),
    memoryUsed: v.number(),
    apiCalls: v.number(),
  })),
  error: v.optional(v.object({
    code: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    context: v.record(v.string(), v.any()),
  })),
  debug: v.optional(v.record(v.string(), v.any())),
})),
```

## 3. Update convex/memory_schema.ts

### shortTermMemory & longTermMemory tables
```typescript
// OLD:
structuredData: v.optional(v.any()),
sourceMetadata: v.optional(v.any()),

// NEW:
structuredData: v.optional(v.object({
  preferences: v.optional(v.object({
    contractViewPreferences: v.optional(v.object({
      sortBy: v.string(),
      filterBy: v.record(v.string(), v.array(v.string())),
      viewMode: v.union(v.literal("grid"), v.literal("list"), v.literal("kanban")),
    })),
    notificationSettings: v.optional(v.object({
      emailFrequency: v.string(),
      alertTypes: v.array(v.string()),
      quietHours: v.object({ start: v.number(), end: v.number() }),
    })),
    dashboardLayout: v.optional(v.object({
      widgets: v.array(v.object({
        id: v.string(),
        position: v.object({ x: v.number(), y: v.number(), w: v.number(), h: v.number() }),
        config: v.record(v.string(), v.any()),
      })),
    })),
  })),
  patterns: v.optional(v.object({
    workingHours: v.optional(v.array(v.object({ day: v.string(), start: v.string(), end: v.string() }))),
    commonSearches: v.optional(v.array(v.object({ query: v.string(), count: v.number() }))),
    frequentActions: v.optional(v.array(v.object({ action: v.string(), resource: v.string(), count: v.number() }))),
    preferredVendors: v.optional(v.array(v.object({ category: v.string(), vendorIds: v.array(v.string()) }))),
  })),
  knowledge: v.optional(v.object({
    terminology: v.optional(v.record(v.string(), v.string())),
    businessRules: v.optional(v.array(v.object({
      rule: v.string(),
      condition: v.string(),
      action: v.string(),
    }))),
    relationships: v.optional(v.array(v.object({
      entity1: v.object({ type: v.string(), id: v.string() }),
      entity2: v.object({ type: v.string(), id: v.string() }),
      relationship: v.string(),
    }))),
  })),
  feedback: v.optional(v.object({
    corrections: v.optional(v.array(v.object({
      original: v.string(),
      corrected: v.string(),
      context: v.string(),
    }))),
    ratings: v.optional(v.array(v.object({
      feature: v.string(),
      rating: v.number(),
      comment: v.optional(v.string()),
    }))),
  })),
})),
sourceMetadata: v.optional(v.object({
  conversation: v.optional(v.object({
    messageId: v.string(),
    threadId: v.string(),
    intent: v.string(),
    confidence: v.number(),
  })),
  task: v.optional(v.object({
    taskId: v.string(),
    taskType: v.string(),
    outcome: v.union(v.literal("success"), v.literal("failure")),
    duration: v.number(),
  })),
  userAction: v.optional(v.object({
    action: v.string(),
    component: v.string(),
    timestamp: v.string(),
    result: v.string(),
  })),
  observation: v.optional(v.object({
    pattern: v.string(),
    frequency: v.number(),
    confidence: v.number(),
    examples: v.array(v.string()),
  })),
})),
```

## 4. Update convex/notification_schema.ts

### notifications table
```typescript
// OLD:
metadata: v.optional(v.any()),

// NEW:
metadata: v.optional(v.object({
  contractExpiration: v.optional(v.object({
    contractId: v.string(),
    contractTitle: v.string(),
    vendorName: v.string(),
    expirationDate: v.string(),
    daysUntilExpiration: v.number(),
    value: v.optional(v.number()),
    autoRenew: v.boolean(),
  })),
  approval: v.optional(v.object({
    approvalId: v.string(),
    type: v.union(
      v.literal("contract"),
      v.literal("vendor"),
      v.literal("payment"),
      v.literal("change")
    ),
    requestedBy: v.string(),
    requestedAt: v.string(),
    urgency: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    details: v.record(v.string(), v.any()),
  })),
  payment: v.optional(v.object({
    paymentId: v.string(),
    contractId: v.string(),
    vendorName: v.string(),
    amount: v.number(),
    currency: v.string(),
    dueDate: v.string(),
    status: v.string(),
  })),
  riskAlert: v.optional(v.object({
    riskType: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    affectedContracts: v.array(v.string()),
    affectedVendors: v.array(v.string()),
    description: v.string(),
    recommendedAction: v.string(),
  })),
  batch: v.optional(v.object({
    notificationIds: v.array(v.string()),
    summary: v.object({
      total: v.number(),
      byType: v.record(v.string(), v.number()),
      byPriority: v.record(v.string(), v.number()),
    }),
  })),
})),
```

### notificationEvents table
```typescript
// OLD:
metadata: v.optional(v.any()),

// NEW:
metadata: v.optional(v.object({
  channel: v.optional(v.string()),
  error: v.optional(v.string()),
  timestamp: v.optional(v.string()),
  attemptNumber: v.optional(v.number()),
  deliveryMethod: v.optional(v.string()),
  userAction: v.optional(v.string()),
})),
```

## 5. Update convex/security/auditLogging.ts

### auditLogs table
```typescript
// OLD:
changes: v.optional(v.any()),
metadata: v.optional(v.any()),

// NEW:
changes: v.optional(v.object({
  before: v.optional(v.record(v.string(), v.any())),
  after: v.optional(v.record(v.string(), v.any())),
  fields: v.optional(v.array(v.string())),
  delta: v.optional(v.array(v.object({
    field: v.string(),
    oldValue: v.any(),
    newValue: v.any(),
  }))),
})),
metadata: v.optional(v.object({
  request: v.optional(v.object({
    method: v.string(),
    endpoint: v.string(),
    parameters: v.record(v.string(), v.any()),
    headers: v.record(v.string(), v.string()),
  })),
  security: v.optional(v.object({
    authMethod: v.string(),
    permissions: v.array(v.string()),
    roleLevel: v.number(),
    impersonating: v.optional(v.string()),
  })),
  business: v.optional(v.object({
    reason: v.string(),
    approvedBy: v.optional(v.string()),
    workflowId: v.optional(v.string()),
    batchOperation: v.optional(v.object({
      total: v.number(),
      processed: v.number(),
      failed: v.number(),
    })),
  })),
  system: v.optional(v.object({
    version: v.string(),
    module: v.string(),
    feature: v.string(),
    automated: v.boolean(),
  })),
})),
```

## Implementation Steps

1. **Create the types file**: Copy the `schema-types.ts` file to `convex/types/schema-types.ts`

2. **Update schemas gradually**: Start with one table at a time to ensure compatibility

3. **Test thoroughly**: After each update, test that:
   - Existing data still works
   - New data follows the proper structure
   - Type checking catches invalid data

4. **Consider migration**: For existing data that doesn't match the new structure:
   - Write migration functions to transform old data
   - Add backward compatibility where needed
   - Gradually phase out untyped data

5. **Update related code**: Find and update any code that creates or reads these fields to use the new types

## Benefits

- **Type Safety**: Catch errors at compile time instead of runtime
- **IntelliSense**: Better IDE support with autocomplete
- **Documentation**: Types serve as documentation for data structures  
- **Validation**: Automatic validation of data shapes
- **Maintainability**: Easier to understand and modify data structures

## Notes on Remaining `v.any()` Usage

Some fields still use `v.any()` where flexibility is absolutely required:
- Component props/state (can vary widely)
- API parameters (depends on external APIs)
- Debug data (unpredictable structure)
- Extensible configurations (plugin systems)

For these cases, consider:
1. Using `v.record(v.string(), v.any())` for key-value pairs
2. Creating discriminated unions for known variants
3. Adding runtime validation in handlers
4. Documenting expected structures in comments