# User Role Permissions Guide

## Role Hierarchy (highest to lowest)

1. **Owner** (Level 5)
2. **Admin** (Level 4) 
3. **Manager** (Level 3)
4. **User** (Level 2) ← **Normal users who can add contracts/vendors**
5. **Viewer** (Level 1)

## Detailed Permissions

### 👑 Owner
- **Full system access**
- Manage enterprise settings
- Add/remove users
- Change user roles (including other owners)
- All contract and vendor operations
- Access agent system controls
- View all analytics and reports
- Delete enterprise data

### 🛡️ Admin  
- **Almost full access** (cannot modify owners)
- Add/remove users (except owners)
- Change user roles (except owners)
- All contract and vendor operations
- Access agent system controls
- View all analytics and reports
- Cannot delete enterprise

### 📊 Manager
- **Operational management**
- View enterprise users (cannot modify)
- All contract and vendor operations
- Create/manage agent tasks
- View analytics and reports
- Approve/reject contracts
- Export data

### 👤 User (Normal User)
- **Standard business user**
- ✅ **Create contracts and vendors**
- ✅ **Edit contracts and vendors they created**
- ✅ **Upload contract files**
- ✅ **Add notes and updates**
- ✅ **View contracts and vendors**
- ✅ **Basic reporting**
- ❌ Cannot manage other users
- ❌ Cannot access agent system
- ❌ Cannot delete others' data
- ❌ Cannot change enterprise settings

### 👁️ Viewer
- **Read-only access**
- View contracts and vendors
- View basic reports
- Cannot create, edit, or delete anything
- Cannot access user management
- Cannot access agent system

## Permission Levels for Operations

### Contract Operations
| Operation | Owner | Admin | Manager | User | Viewer |
|-----------|-------|-------|---------|------|--------|
| View contracts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create contracts | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit own contracts | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit others' contracts | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete contracts | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve contracts | ✅ | ✅ | ✅ | ❌ | ❌ |

### Vendor Operations  
| Operation | Owner | Admin | Manager | User | Viewer |
|-----------|-------|-------|---------|------|--------|
| View vendors | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create vendors | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit own vendors | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit others' vendors | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete vendors | ✅ | ✅ | ✅ | ❌ | ❌ |

### User Management
| Operation | Owner | Admin | Manager | User | Viewer |
|-----------|-------|-------|---------|------|--------|
| View users | ✅ | ✅ | ✅ | ❌ | ❌ |
| Add users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit user roles | ✅ | ✅* | ❌ | ❌ | ❌ |
| Remove users | ✅ | ✅* | ❌ | ❌ | ❌ |

*Admin cannot modify Owner roles

### Agent System
| Operation | Owner | Admin | Manager | User | Viewer |
|-----------|-------|-------|---------|------|--------|
| View agent status | ✅ | ✅ | ✅ | ❌ | ❌ |
| Control agents | ✅ | ✅ | ❌ | ❌ | ❌ |
| View insights | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create tasks | ✅ | ✅ | ✅ | ❌ | ❌ |

## Implementation Example

```typescript
// Example permission check in your contract creation function
export const createContract = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Check if user has permission to create contracts
    const hasAccess = await ctx.runQuery(api.users.hasEnterpriseAccess, {
      enterpriseId: args.enterpriseId,
      requiredRole: "user" // Minimum role needed
    });

    if (!hasAccess) {
      throw new ConvexError("Permission denied: Insufficient privileges to create contracts");
    }

    // ... rest of creation logic
  },
});
```

## Default Role Assignment

- **New users default to "user" role** - allows them to immediately start working with contracts and vendors
- **First user in an enterprise becomes "owner"**
- **Additional users can be promoted by owners/admins as needed**

## Quick Reference

### 🎯 Who Can Do What?

**Create Contracts/Vendors:** Owner, Admin, Manager, User  
**Manage Users:** Owner, Admin  
**Control Agents:** Owner, Admin  
**View Everything:** Owner, Admin, Manager  
**Basic Operations:** Owner, Admin, Manager, User  
**Read Only:** Viewer  

### 🔒 Security Notes

- Users can only access data within their enterprise
- Users can only edit resources they created (unless they're Manager+)
- Role changes require Admin+ privileges
- Owner role changes require Owner privileges
- All operations are logged for audit purposes