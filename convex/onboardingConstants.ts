/**
 * Onboarding steps that users go through
 */
export const ONBOARDING_STEPS = {
  ACCOUNT_TYPE: 'account_type',      // Choose between creating or joining
  CREATE_ENTERPRISE: 'create_enterprise',
  JOIN_ENTERPRISE: 'join_enterprise',
  PROFILE_SETUP: 'profile_setup',
  ENTERPRISE_CONFIG: 'enterprise_config', // Only for owners/admins
  INVITE_TEAM: 'invite_team',        // Optional
  FIRST_CONTRACT: 'first_contract',   // Optional tutorial
  COMPLETE: 'complete',              // Final step
} as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[keyof typeof ONBOARDING_STEPS];