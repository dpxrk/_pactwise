import { query, mutation, action, MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { ONBOARDING_STEPS, type OnboardingStep } from "./onboardingConstants";

/**
 * Check user's onboarding status and determine next step
 */
export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        isOnboarded: false,
        currentStep: ONBOARDING_STEPS.ACCOUNT_TYPE,
        requiresOnboarding: true,
      };
    }

    // Check if user exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      // New user - needs to choose account type
      return {
        isOnboarded: false,
        currentStep: ONBOARDING_STEPS.ACCOUNT_TYPE,
        requiresOnboarding: true,
        userEmail: identity.email,
      };
    }

    // Get enterprise details
    const enterprise = await ctx.db.get(user.enterpriseId);
    
    // Get onboarding record
    const onboarding = await ctx.db
      .query("userOnboarding")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    // Check various completion states
    const hasProfile = !!(user.firstName && user.lastName);
    const hasEnterprise = !!enterprise;
    const isOwnerOrAdmin = user.role === 'owner' || user.role === 'admin';
    
    // Determine current step
    let currentStep: OnboardingStep = ONBOARDING_STEPS.COMPLETE;
    let requiresOnboarding = false;

    if (!hasEnterprise) {
      currentStep = ONBOARDING_STEPS.CREATE_ENTERPRISE;
      requiresOnboarding = true;
    } else if (!hasProfile) {
      currentStep = ONBOARDING_STEPS.PROFILE_SETUP;
      requiresOnboarding = true;
    } else if (isOwnerOrAdmin && !enterprise.industry) {
      currentStep = ONBOARDING_STEPS.ENTERPRISE_CONFIG;
      requiresOnboarding = true;
    } else if (onboarding && !onboarding.completedAt) {
      currentStep = (Object.values(ONBOARDING_STEPS) as OnboardingStep[]).includes(onboarding.currentStep as OnboardingStep)
        ? onboarding.currentStep as OnboardingStep
        : ONBOARDING_STEPS.INVITE_TEAM;
      requiresOnboarding = true;
    }

    // Check if they've created any contracts
    const hasContracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", user.enterpriseId)
      )
      .first();

    return {
      isOnboarded: !requiresOnboarding,
      currentStep,
      requiresOnboarding,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        hasProfile,
      },
      enterprise: enterprise ? {
        id: enterprise._id,
        name: enterprise.name,
        hasConfig: !!enterprise.industry,
      } : null,
      progress: {
        hasProfile,
        hasEnterprise,
        hasEnterpriseConfig: enterprise?.industry ? true : false,
        hasContracts: !!hasContracts,
      },
      onboarding: onboarding || null,
    };
  },
});

/**
 * Helper function to update onboarding step
 * This is used internally to avoid circular references
 */
async function updateOnboardingStepHelper(
  ctx: MutationCtx,
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  step: string,
  completed?: boolean,
  metadata?: any
) {
  // Find or create onboarding record
  let onboarding = await ctx.db
    .query("userOnboarding")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (!onboarding) {
    // Create new onboarding record
    const onboardingId = await ctx.db.insert("userOnboarding", {
      userId,
      enterpriseId,
      currentStep: step as OnboardingStep,
      completedSteps: completed ? [step] : [],
      startedAt: new Date().toISOString(),
      metadata: metadata || {},
    });
    return { onboardingId, isNew: true };
  }

  // Update existing record
  const existingSteps = onboarding.completedSteps || [];
  const completedSteps = completed && !existingSteps.includes(step)
    ? [...existingSteps, step]
    : existingSteps;

  await ctx.db.patch(onboarding._id, {
    currentStep: step as OnboardingStep,
    completedSteps,
    ...(metadata && { metadata: { ...onboarding.metadata, ...metadata } }),
    updatedAt: new Date().toISOString(),
  });

  // Check if onboarding is complete
  const requiredSteps = [
    ONBOARDING_STEPS.PROFILE_SETUP,
    // Enterprise config is only required for owners/admins
  ];
  
  const isComplete = requiredSteps.every(s => completedSteps.includes(s));
  
  if (isComplete && !onboarding.completedAt) {
    await ctx.db.patch(onboarding._id, {
      completedAt: new Date().toISOString(),
    });
  }

  return { onboardingId: onboarding._id, isNew: false };
}

/**
 * Start or update onboarding process
 */
export const updateOnboardingStep = mutation({
  args: {
    step: v.string(),
    completed: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new ConvexError("User not found");

    return updateOnboardingStepHelper(
      ctx,
      user._id,
      user.enterpriseId,
      args.step,
      args.completed,
      args.metadata
    );
  },
});

// ============================================================================
// ACCOUNT TYPE SELECTION
// ============================================================================

/**
 * Check if user can join an enterprise via email domain
 */
export const checkEmailDomain = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const domain = args.email.split('@')[1];
    if (!domain) return null;

    const enterprise = await ctx.db
      .query("enterprises")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();

    if (!enterprise) return null;

    // Check if auto-join is enabled (you might want to add this field)
    return {
      enterpriseId: enterprise._id,
      enterpriseName: enterprise.name,
      canAutoJoin: true, // You might want to add settings for this
    };
  },
});

/**
 * Check for pending invitations
 */
export const checkPendingInvitations = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .filter(q => q.eq(q.field("acceptedAt"), undefined))
      .collect();

    const validInvitations = await Promise.all(
      invitations
        .filter(inv => new Date(inv.expiresAt) > new Date())
        .map(async (inv) => {
          const enterprise = await ctx.db.get(inv.enterpriseId);
          const inviter = await ctx.db.get(inv.invitedBy);
          return {
            id: inv._id,
            token: inv.token,
            role: inv.role,
            enterpriseName: enterprise?.name || 'Unknown',
            enterpriseId: inv.enterpriseId, // <<< --- ADD THIS LINE
            inviterName: inviter 
              ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email
              : 'Unknown',
            expiresAt: inv.expiresAt,
          };
        })
    );

    return validInvitations;
  },
});

// ============================================================================
// PROFILE SETUP
// ============================================================================

/**
 * Complete user profile setup
 */
export const completeProfileSetup = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phoneNumber: v.optional(v.string()),
    department: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new ConvexError("User not found");

    // Validate inputs
    if (!args.firstName || args.firstName.trim().length < 1) {
      throw new ConvexError("First name is required");
    }
    if (!args.lastName || args.lastName.trim().length < 1) {
      throw new ConvexError("Last name is required");
    }

    // Update user profile
    await ctx.db.patch(user._id, {
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      ...(args.phoneNumber?.trim() && { phoneNumber: args.phoneNumber.trim() }),
      ...(args.department?.trim() && { department: args.department.trim() }),
      ...(args.title?.trim() && { title: args.title.trim() }),
      updatedAt: new Date().toISOString(),
    });

    // Update onboarding step
    await updateOnboardingStepHelper(
      ctx,
      user._id,
      user.enterpriseId,
      ONBOARDING_STEPS.PROFILE_SETUP,
      true
    );

    return { success: true };
  },
});

// ============================================================================
// ENTERPRISE CONFIGURATION
// ============================================================================

/**
 * Complete enterprise configuration (for owners/admins)
 */
export const completeEnterpriseConfig = mutation({
  args: {
    industry: v.string(),
    size: v.union(
      v.literal("1-10"),
      v.literal("11-50"),
      v.literal("51-200"),
      v.literal("201-500"),
      v.literal("501-1000"),
      v.literal("1000+")
    ),
    contractVolume: v.optional(v.union(
      v.literal("low"),      // < 10 contracts
      v.literal("medium"),   // 10-50 contracts
      v.literal("high"),     // 50-200 contracts
      v.literal("enterprise") // 200+ contracts
    )),
    primaryUseCase: v.optional(v.array(v.string())), // e.g., ["vendor", "customer", "partner", "employee"]
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new ConvexError("User not found");

    // Only owners and admins can configure enterprise
    if (user.role !== "owner" && user.role !== "admin") {
      throw new ConvexError("Only owners and admins can configure enterprise settings");
    }

    const enterprise = await ctx.db.get(user.enterpriseId);
    if (!enterprise) throw new ConvexError("Enterprise not found");

    // Update enterprise with configuration
    await ctx.db.patch(user.enterpriseId, {
      industry: args.industry,
      size: args.size,
      ...(args.contractVolume && { contractVolume: args.contractVolume }),
      ...(args.primaryUseCase && { primaryUseCase: args.primaryUseCase }),
    });

    // Update onboarding step
    await updateOnboardingStepHelper(
      ctx,
      user._id,
      user.enterpriseId,
      ONBOARDING_STEPS.ENTERPRISE_CONFIG,
      true,
      {
        configuredBy: user._id,
        configuredAt: new Date().toISOString(),
      }
    );

    return { success: true };
  },
});

// ============================================================================
// ONBOARDING COMPLETION
// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Skip onboarding (for returning users or special cases)
 */
export const skipOnboarding = mutation({
  args: {
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new ConvexError("User not found");

    const onboarding = await ctx.db
      .query("userOnboarding")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        skippedAt: new Date().toISOString(),
        ...(args.reason && { skipReason: args.reason }),
        completedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("userOnboarding", {
        userId: user._id,
        enterpriseId: user.enterpriseId,
        currentStep: ONBOARDING_STEPS.COMPLETE,
        completedSteps: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        skippedAt: new Date().toISOString(),
        ...(args.reason && { skipReason: args.reason }),
        metadata: {},
      });
    }

    return { success: true };
  },
});

/**
 * Get onboarding analytics (for admins)
 */
export const getOnboardingAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || (user.role !== "owner" && user.role !== "admin")) {
      throw new ConvexError("Access denied");
    }

    const onboardings = await ctx.db
      .query("userOnboarding")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    const analytics = {
      total: onboardings.length,
      completed: onboardings.filter(o => o.completedAt).length,
      inProgress: onboardings.filter(o => !o.completedAt && !o.skippedAt).length,
      skipped: onboardings.filter(o => o.skippedAt).length,
      averageCompletionTime: 0,
      stepCompletion: {} as Record<string, number>,
      dropoffPoints: {} as Record<string, number>,
    };

    // Calculate average completion time
    const completedWithTime = onboardings.filter(o => o.completedAt && o.startedAt);
    if (completedWithTime.length > 0) {
      const totalTime = completedWithTime.reduce((sum, o) => {
        const start = new Date(o.startedAt).getTime();
        const end = new Date(o.completedAt!).getTime();
        return sum + (end - start);
      }, 0);
      analytics.averageCompletionTime = totalTime / completedWithTime.length;
    }

    // Calculate step completion rates
    Object.values(ONBOARDING_STEPS).forEach(step => {
      const completed = onboardings.filter(o => 
        o.completedSteps?.includes(step)
      ).length;
      analytics.stepCompletion[step] = completed;
    });

    // Find dropout points
    const incomplete = onboardings.filter(o => !o.completedAt && !o.skippedAt);
    incomplete.forEach(o => {
      const lastStep = o.currentStep || 'unknown';
      analytics.dropoffPoints[lastStep] = (analytics.dropoffPoints[lastStep] || 0) + 1;
    });

    return analytics;
  },
});