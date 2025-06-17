# Uncategorized Vendors and Contracts Feature Summary

## Overview
This document summarizes the changes made to support uncategorized vendors and contracts in the Pactwise system. The changes allow vendors and contracts to exist without an assigned category/type, making them "uncategorized" until manually assigned by users or automatically assigned by the vendor agent.

## Schema Changes

### Vendors Table (`convex/schema.ts`)
- `category` field remains optional - vendors without a category are considered "uncategorized"
- Added `createdBy` field to track if vendor was created by user or system
- Added `metadata` field for agent-specific data
- Added `updatedAt` field to track last update time

### Contracts Table (`convex/schema.ts`)
- `vendorId` is now optional - allows contracts to exist without an assigned vendor
- `contractType` field remains optional - contracts without a type are considered "uncategorized"
- Added `extractedAddress` field for vendor matching
- Added `updatedAt` field to track last update time

## Backend Changes

### Vendor Mutations (`convex/vendors.ts`)
- Updated analytics to treat vendors without category as "uncategorized" instead of "other"
- Category analytics now properly count uncategorized vendors
- Spend analytics handle uncategorized vendors correctly

### Contract Mutations (`convex/contracts.ts`)
- `createContract` now accepts optional `vendorId`
- Added `assignVendorToContract` mutation for manual vendor assignment
- Updated `updateContract` to allow vendor assignment
- Added `getUnassignedContracts` query to fetch contracts without vendors
- Contract statistics now include count of unassigned contracts
- Contract type analytics treat contracts without type as "uncategorized"

## Frontend Changes

### Display Utilities (`src/lib/display-utils.ts`)
- Created utility functions to handle display of uncategorized items:
  - `getVendorCategoryDisplay()` - Returns "Uncategorized" for vendors without category
  - `getContractTypeDisplay()` - Returns "Uncategorized" for contracts without type
  - Badge styling functions for visual consistency
  - Helper functions to check if items are uncategorized

## How It Works

1. **Vendor Creation**: Vendors can be created without a category. The UI will display them as "Uncategorized"
2. **Contract Creation**: Contracts can be created without a vendor assignment. They remain unassigned until:
   - A user manually assigns a vendor using the `assignVendorToContract` mutation
   - The vendor agent automatically matches and assigns vendors based on extracted data
3. **Analytics**: All analytics and reporting properly handle uncategorized items, counting them separately

## Usage Examples

### Creating an unassigned contract:
```typescript
await createContract({
  enterpriseId,
  title: "New Contract",
  storageId,
  fileName: "contract.pdf",
  fileType: "application/pdf",
  // vendorId is omitted - contract is unassigned
});
```

### Manually assigning a vendor to a contract:
```typescript
await assignVendorToContract({
  contractId,
  vendorId,
  enterpriseId,
});
```

### Querying unassigned contracts:
```typescript
const unassignedContracts = await getUnassignedContracts({
  enterpriseId,
});
```

## Benefits

1. **Flexibility**: Users can upload contracts before identifying vendors
2. **Gradual Organization**: Start with unorganized data and categorize over time
3. **Agent Integration**: The vendor agent can process unassigned contracts and suggest/create vendors
4. **Better UX**: No forced categorization - users can work at their own pace

## Future Considerations

- The vendor agent will be able to:
  - Automatically match contracts to existing vendors
  - Create new vendors when no match is found
  - Suggest categorizations based on contract content
- UI improvements to highlight uncategorized items for review
- Bulk categorization tools for efficiency