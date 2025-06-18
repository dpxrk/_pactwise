import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";

// Import constants from the separate constants file
import { ONBOARDING_STEPS } from "./onboardingConstants";

/**
 * Complete onboarding process
 */
export const completeOnboarding = action({
  args: {
    skippedSteps: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    // Mark as complete using the simplified path
    await ctx.runMutation(api.onboarding.updateOnboardingStep, {
      step: ONBOARDING_STEPS.COMPLETE,
      completed: true,
      metadata: {
        skippedSteps: args.skippedSteps || [],
        completedVia: 'skip',
      },
    });

    return { success: true };
  },
});

/**
 * Send team invitations
 */
export const sendTeamInvitations = action({
  args: {
    invitations: v.array(v.object({
      email: v.string(),
      role: v.union(
        v.literal('owner'),
        v.literal('admin'),
        v.literal('manager'),
        v.literal('user'),
        v.literal('viewer')
      ),
      message: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");

    // Here you would implement actual email sending logic
    // For now, we'll just log the invitations
    console.log(`Sending ${args.invitations.length} invitations`);

    // Update onboarding step using the simplified path
    await ctx.runMutation(api.onboarding.updateOnboardingStep, {
      step: ONBOARDING_STEPS.INVITE_TEAM,
      completed: true,
      metadata: {
        invitationsSent: args.invitations.length,
        invitedEmails: args.invitations.map(inv => inv.email),
      },
    });

    return { 
      success: true, 
      invitationsSent: args.invitations.length,
    };
  },
});