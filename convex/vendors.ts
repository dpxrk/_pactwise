import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ==== VENDOR QUERIES ====

export const listVendors = query({
  args: {
    enterpriseId: v.id("enterprises"),
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { enterpriseId, status, category, limit = 10, cursor } = args;
    
    let vendorsQuery = ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .order("desc");
    
    if (status) {
      vendorsQuery = vendorsQuery.filter((q) => q.eq(q.field("status"), status));
    }
    
    if (category) {
      vendorsQuery = vendorsQuery.filter((q) => q.eq(q.field("category"), category));
    }
    
    
    
    // Apply limit and execute the query
    const vendors = await vendorsQuery.take(limit);
    
    // For each vendor, get a count of associated contracts
    const vendorsWithContractCount = await Promise.all(
      vendors.map(async (vendor) => {
        const contractCount = await ctx.db
          .query("contracts")
          .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
          //@ts-expect-error          
          .count();
        
        return {
          ...vendor,
          contractCount,
        };
      })
    );
    
    return vendorsWithContractCount;
  },
});

export const getVendor = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    const vendor = await ctx.db.get(args.vendorId);
    
    if (!vendor) {
      return null;
    }
    
    // Get vendor contacts
    const contacts = await ctx.db
      .query("vendorContacts")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .collect();
    
    // Get vendor documents
    const documents = await ctx.db
      .query("vendorDocuments")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .collect();
    
    // Get contracts associated with this vendor
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .collect();
    
    // Get department if it exists
    let department = null;
    if (vendor.departmentId) {
      department = await ctx.db.get(vendor.departmentId);
    }
    
    return {
      ...vendor,
      contacts,
      documents,
      contracts,
      department,
    };
  },
});

export const searchVendors = query({
  args: {
    enterpriseId: v.id("enterprises"),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { enterpriseId, searchTerm, limit = 20 } = args;
    
    // Normalize search term for case-insensitive search
    const normalizedTerm = searchTerm.toLowerCase().trim();
    
    // Get all vendors for the enterprise
    const allVendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .collect();
    
    // Filter vendors based on search term
    const matchingVendors = allVendors.filter(vendor => 
      (vendor.name && vendor.name.toLowerCase().includes(normalizedTerm)) ||
      (vendor.description && vendor.description.toLowerCase().includes(normalizedTerm)) ||
      (vendor.taxId && vendor.taxId.toLowerCase().includes(normalizedTerm)) ||
      (vendor.registrationNumber && vendor.registrationNumber.toLowerCase().includes(normalizedTerm))
    ).slice(0, limit);
    
    return matchingVendors;
  },
});

// ==== VENDOR MUTATIONS ====

export const createVendor = mutation({
  args: {
    name: v.string(),
    vendorType: v.string(),
    category: v.string(),
    status: v.optional(v.string()),
    taxId: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    currency: v.optional(v.string()),
    primaryAddress: v.optional(v.object({
      street1: v.string(),
      street2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
      isPrimary: v.optional(v.boolean()),
      addressType: v.optional(v.string()),
    })),
    enterpriseId: v.id("enterprises"),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const  identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const now = new Date().toISOString();
    
    // Set vendor defaults
    const vendorData = {
      name: args.name,
      vendorType: args.vendorType,
      category: args.category,
      status: args.status || "active",
      taxId: args.taxId,
      registrationNumber: args.registrationNumber,
      website: args.website,
      description: args.description || "",
      paymentTerms: args.paymentTerms || "Net 30",
      currency: args.currency || "USD",
      primaryAddress: args.primaryAddress,
      enterpriseId: args.enterpriseId,
      departmentId: args.departmentId,
      createdAt: now,
      createdById: user._id,
      lastAccessedAt: now,
      lastAccessedById: user._id,
    };
    // Ensure required address fields are set
    if (vendorData.primaryAddress) {
      vendorData.primaryAddress.isPrimary = true;
      vendorData.primaryAddress.addressType = vendorData.primaryAddress.addressType || 'business';
    }
    
    // Create the vendor
    //@ts-expect-error
    const vendorId = await ctx.db.insert("vendors", vendorData);
    
    // Log vendor creation
    await ctx.db.insert("userActivityLog", {
      userId: user._id,
      action: "create_vendor",
      resourceType: "vendor",
      resourceId: vendorId,
      details: { vendorName: args.name, vendorType: args.vendorType },
      timestamp: now,
    });
    
    return vendorId;
  },
});

export const updateVendor = mutation({
  args: {
    vendorId: v.id("vendors"),
    name: v.optional(v.string()),
    vendorType: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    taxId: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    description: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    currency: v.optional(v.string()),
    primaryAddress: v.optional(v.object({
      street1: v.string(),
      street2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
      isPrimary: v.optional(v.boolean()),
      addressType: v.optional(v.string()),
    })),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get the existing vendor
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }
    
    // Create update object with only the fields being changed
    const updates = {};
    for (const [key, value] of Object.entries(args)) {
      if (key !== "vendorId" && value !== undefined) {
        (updates as Record<string, any>)[key] = value;
      }
    }
    
    // Add updated timestamp
    (updates as any).updatedAt = new Date().toISOString();
    (updates as any).lastAccessedAt = (updates as any).updatedAt;
    (updates as any).lastAccessedById = user._id;
    
    // Update the vendor
    await ctx.db.patch(args.vendorId, updates);
    
    // Log vendor update
    await ctx.db.insert("userActivityLog", {
      userId: user._id,
      action: "update_vendor",
      resourceType: "vendor",
      resourceId: args.vendorId,
      details: { updatedFields: Object.keys(updates) },
      timestamp: (updates as any).updatedAt,
    });
    
    return args.vendorId;
  },
});

export const addVendorContact = mutation({
  args: {
    vendorId: v.id("vendors"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    contactType: v.string(),
    isPrimary: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if this is set as primary and handle existing primary contacts
    if (args.isPrimary) {
      const existingPrimaryContacts = await ctx.db
        .query("vendorContacts")
        .withIndex("by_primary", (q) => 
          q.eq("vendorId", args.vendorId).eq("isPrimary", true)
        )
        .collect();
      
      // Update any existing primary contacts to not be primary
      for (const contact of existingPrimaryContacts) {
        await ctx.db.patch(contact._id, { isPrimary: false });
      }
    }
    
    const now = new Date().toISOString();
    
    // Create the contact
    const contactId = await ctx.db.insert("vendorContacts", {
      vendorId: args.vendorId,
      firstName: args.firstName || "",
      lastName: args.lastName || "",
      email: args.email,
      phone: args.phone || "",
      title: args.title || "",
      contactType: args.contactType,
      isPrimary: args.isPrimary || false,
      notes: args.notes || "",
      createdAt: now,
      updatedAt: now,
      createdById: user._id,
    });
    
    // Update the vendor's last accessed timestamp
    await ctx.db.patch(args.vendorId, {
      lastAccessedAt: now,
      lastAccessedById: user._id,
    });
    
    return contactId;
  },
});

export const deleteVendorContact = mutation({
  args: {
    contactId: v.id("vendorContacts"),
  },
  handler: async (ctx, args) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get the contact to check permissions and get vendorId
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }
    
    // Delete the contact
    await ctx.db.delete(args.contactId);
    
    // Update the vendor's last accessed timestamp
    await ctx.db.patch(contact.vendorId, {
      lastAccessedAt: new Date().toISOString(),
      lastAccessedById: user._id,
    });
    
    return { success: true };
  },
});

export const updateVendorContact = mutation({
  args: {
    contactId: v.id("vendorContacts"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    contactType: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get the contact to check permissions and get vendorId
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }
    
    // Handle primary contact status
    if (args.isPrimary) {
      const existingPrimaryContacts = await ctx.db
        .query("vendorContacts")
        .withIndex("by_primary", (q) => 
          q.eq("vendorId", contact.vendorId).eq("isPrimary", true)
        )
        .filter((q) => q.neq(q.field("_id"), args.contactId))
        .collect();
      
      // Update any existing primary contacts to not be primary
      for (const primaryContact of existingPrimaryContacts) {
        await ctx.db.patch(primaryContact._id, { isPrimary: false });
      }
    }
    
    // Create update object with only the fields being changed
    const updates = {};
    for (const [key, value] of Object.entries(args)) {
      if (key !== "contactId" && value !== undefined) {
        (updates as Record<string, any>)[key] = value;
      }
    }
    
    // Add updated timestamp
    (updates as any).updatedAt = new Date().toISOString();
    
    // Update the contact
    await ctx.db.patch(args.contactId, updates);
    
    // Update the vendor's last accessed timestamp
    await ctx.db.patch(contact.vendorId, {
      lastAccessedAt: (updates as any).updatedAt,
      lastAccessedById: user._id,
    });
    
    return args.contactId;
  },
});