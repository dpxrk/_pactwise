// convex/auth.ts
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";



/**
 * User login action
 */
export const login = action({
  args: {
    email: v.string(),
    password: v.string(),
    user_agent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { email, password, user_agent } = args;

    try {
      // Find user by email
      const user = await ctx.runQuery(internal.users.getUserByEmail, { email });
      
      if (!user) {
        // Log failed login attempt
        await ctx.runAction(internal.auth.logAuthFailureInternal, {
          email,
          error: "User not found",
          timestamp: new Date().toISOString(),
          user_agent: user_agent || "unknown",
          attemptType: "login",
        });
        
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Check if user is active
      if (!user.isActive) {
        await ctx.runAction(internal.auth.logAuthFailureInternal, {
          email,
          error: "Account inactive",
          timestamp: new Date().toISOString(),
          user_agent: user_agent || "unknown",
          attemptType: "login",
          userId: user._id,
        });
        
        return {
          success: false,
          message: "Your account is inactive. Please contact support.",
        };
      }

      // Check password
      const passwordMatch = await comparePasswords(password, user.hashedPassword || "");
      
      if (!passwordMatch) {
        // Log failed login attempt
        await ctx.runAction(internal.auth.logAuthFailureInternal, {
          email,
          error: "Invalid password",
          timestamp: new Date().toISOString(),
          user_agent: user_agent || "unknown",
          attemptType: "login",
          userId: user._id,
        });
        
        // Increment failed login attempts
        await ctx.runMutation(internal.users.incrementFailedLoginAttempts, {
          userId: user._id,
        });
        
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      // Generate authentication token
      const token = generateToken();
      const sessionId = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // Token expires in 14 days
      
      // Create a user session
      await ctx.runMutation(internal.users.createUserSession, {
        userId: user._id,
        sessionId,
        token,
        expiresAt: expiresAt.toISOString(),
        ipAddress: "unknown", // In a real implementation, you'd get this from the request
        userAgent: user_agent || "unknown",
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      
      // Update last login timestamp and reset failed login attempts
      await ctx.runMutation(internal.users.updateLastLogin, {
        userId: user._id,
      });
      
      // Log successful login
      await ctx.runMutation(internal.users.logLoginAttempt, {
        userId: user._id,
        email: user.email,
        timestamp: new Date().toISOString(),
        ipAddress: "unknown",
        userAgent: user_agent || "unknown",
        success: true,
        authProvider: "password",
      });
      
      // Get user's enterprise details for frontend
      const enterprise = user.enterpriseId
        ? await ctx.runQuery(internal.enterprises.getEnterpriseBasicInfo, {
            enterpriseId: user.enterpriseId,
          })
        : null;

      // Return success with user data
      return {
        success: true,
        message: "Login successful",
        token,
        userId: user._id,
        userData: {
          email: user.email,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          role: user.role,
          enterprise: enterprise
            ? {
                name: enterprise.name,
                logo: enterprise.logo,
                primaryColor: enterprise.primaryColor,
                secondaryColor: enterprise.secondaryColor,
              }
            : null,
        },
      };
    } catch (error) {
      // Log unexpected error
      await ctx.runAction(internal.auth.logAuthFailureInternal, {
        email,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        user_agent: user_agent || "unknown",
        attemptType: "login",
      });
      
      return {
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      };
    }
  },
});

/**
 * User registration action
 */
export const register = action({
  args: {
    email: v.string(),
    password: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    title: v.optional(v.string()),
    enterpriseId: v.optional(v.id("enterprises")),
    user_agent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { email, password, firstName, lastName, title, enterpriseId, user_agent } = args;

    try {
      // Check if user already exists
      const existingUser = await ctx.runQuery(internal.users.getUserByEmail, { email });
      
      if (existingUser) {
        await ctx.runAction(internal.auth.logAuthFailureInternal, {
          email,
          error: "Email already exists",
          timestamp: new Date().toISOString(),
          user_agent: user_agent || "unknown",
          attemptType: "register",
        });
        
        return {
          success: false,
          message: "A user with this email already exists",
        };
      }

      // If enterpriseId is provided, verify it exists
      if (enterpriseId) {
        const enterprise = await ctx.runQuery(internal.enterprises.getEnterpriseBasicInfo, {
          enterpriseId,
        });
        
        if (!enterprise) {
          return {
            success: false,
            message: "Invalid enterprise",
          };
        }
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Create the user
      const now = new Date().toISOString();
      const userId = await ctx.runMutation(internal.users.createUser, {
        email,
        firstName,
        lastName,
        title,
        hashedPassword,
        enterpriseId,
        role: "contract_viewer", // Default role for new users
        status: "active", // Status from UserStatus enum
        isActive: true, // New users are active by default
        isEmailVerified: false, // Email verification needed
        authType: "password", // AuthenticationType enum value
        authProvider: "email", // AuthProvider enum value
        language: "en-US", // Default language
        timezone: "UTC", // Default timezone
        dateFormat: "MM/DD/YYYY", // Default date format
        notificationPreferences: {
          emailEnabled: true,
          inAppEnabled: true,
          smsEnabled: false,
          contractNotifications: true,
          approvalNotifications: true,
          signatureNotifications: true,
          analyticsNotifications: false,
        },
        securityPreferences: {
          mfaEnabled: false,
          sessionTimeout: 60, // Minutes
        },
        failedLoginAttempts: 0,
        permissions: [],
        accessibleContracts: [],
        accessibleTemplates: [],
        accessibleDepartments: [],
        contractsCreated: 0,
        contractsSigned: 0,
        templatesCreated: 0,
        activeSessions: 0,
        createdAt: now,
      });
      
      // Generate email verification token
      const verificationToken = generateToken();
      await ctx.runMutation(internal.users.createEmailVerificationToken, {
        userId,
        email,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        isUsed: false,
        createdAt: now,
        ipRequested: "unknown",
      });
      
      // TODO: Send verification email in a real implementation
      
      // Generate authentication token
      const token = generateToken();
      const sessionId = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // Token expires in 14 days
      
      // Create a user session
      await ctx.runMutation(internal.users.createUserSession, {
        userId,
        sessionId,
        token,
        expiresAt: expiresAt.toISOString(),
        ipAddress: "unknown", // In a real implementation, you'd get this from the request
        userAgent: user_agent || "unknown",
        isActive: true,
        createdAt: now,
      });

      // Get enterprise details for the response
      const enterprise = enterpriseId
        ? await ctx.runQuery(internal.enterprises.getEnterpriseBasicInfo, {
            enterpriseId,
          })
        : null;

      // Log successful registration
      await ctx.runMutation(internal.users.logLoginAttempt, {
        userId,
        email,
        timestamp: now,
        ipAddress: "unknown",
        userAgent: user_agent || "unknown",
        success: true,
        authProvider: "email",
      });

      // Return success with user data
      return {
        success: true,
        message: "Registration successful",
        token,
        userId,
        userData: {
          email,
          firstName,
          lastName,
          role: "contract_viewer",
          enterprise: enterprise
            ? {
                name: enterprise.name,
                logo: enterprise.logo,
                primaryColor: enterprise.primaryColor,
                secondaryColor: enterprise.secondaryColor,
              }
            : null,
        },
      };
    } catch (error) {
      await ctx.runAction(internal.auth.logAuthFailureInternal, {
        email,
        error: error instanceof Error ? error.message : "Registration failed",
        timestamp: new Date().toISOString(),
        user_agent: user_agent || "unknown",
        attemptType: "register",
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : "Registration failed",
      };
    }
  },
});

/**
 * Log authentication failures for security monitoring
 */
export const logAuthFailure = action({
  args: {
    email: v.string(),
    error: v.string(),
    timestamp: v.string(),
    user_agent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.auth.logAuthFailureInternal, {
      ...args,
      attemptType: "client-reported",
    });
    return { success: true };
  },
});

/**
 * Internal action to log authentication failures
 * This is used internally by the login and register actions
 */
export const logAuthFailureInternal = internalAction({
  args: {
    email: v.string(),
    error: v.string(),
    timestamp: v.string(),
    user_agent: v.optional(v.string()),
    attemptType: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { email, error, timestamp, user_agent, attemptType, userId } = args;
    
    // Log auth failure to the database
    await ctx.runMutation(internal.users.createAuthFailure, {
      email,
      error,
      timestamp,
      userAgent: user_agent || "unknown",
      ipAddress: "unknown", // In a real implementation, you'd get this from the request
      attemptType,
      userId,
    });
    
    return { success: true };
  },
});

/**
 * Request password reset
 */
export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const { email } = args;
    
    try {
      // Find user by email
      const user = await ctx.runQuery(internal.users.getUserByEmail, { email });
      
      if (!user) {
        // We don't want to reveal if an email exists or not for security reasons
        return {
          success: true,
          message: "If your email is registered, you will receive a password reset link shortly",
        };
      }

      // Generate reset token
      const resetToken = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour
      
      // Save reset token
      await ctx.runMutation(internal.users.createPasswordResetToken, {
        userId: user._id,
        token: resetToken,
        expiresAt: expiresAt.toISOString(),
        isUsed: false,
        createdAt: new Date().toISOString(),
        ipRequested: "unknown",
      });
      
      // TODO: Send password reset email in a real implementation
      
      return {
        success: true,
        message: "If your email is registered, you will receive a password reset link shortly",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to process password reset request",
      };
    }
  },
});

/**
 * Reset password using token
 */
export const resetPassword = action({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const { token, newPassword } = args;
    
    try {
      // Verify token and get user
      const resetToken = await ctx.runQuery(internal.users.getPasswordResetToken, {
        token,
      });
      
      if (!resetToken || resetToken.isUsed) {
        return {
          success: false,
          message: "Invalid or expired reset token",
        };
      }

      // Check if token is expired
      if (new Date(resetToken.expiresAt) < new Date()) {
        return {
          success: false,
          message: "Reset token has expired",
        };
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user's password and mark token as used
      await ctx.runMutation(internal.users.resetUserPassword, {
        userId: resetToken.userId,
        hashedPassword,
        resetTokenId: resetToken._id,
        ipUsed: "unknown",
      });
      
      return {
        success: true,
        message: "Password has been reset successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to reset password",
      };
    }
  },
});

/**
 * Verify email with token
 */
export const verifyEmail = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { token } = args;
    
    try {
      // Verify token and get user
      const verificationToken = await ctx.runQuery(internal.users.getEmailVerificationToken, {
        token,
      });
      
      if (!verificationToken || verificationToken.isUsed) {
        return {
          success: false,
          message: "Invalid or expired verification token",
        };
      }

      // Check if token is expired
      if (new Date(verificationToken.expiresAt) < new Date()) {
        return {
          success: false,
          message: "Verification token has expired",
        };
      }

      // Mark user's email as verified and token as used
      await ctx.runMutation(internal.users.verifyUserEmail, {
        userId: verificationToken.userId,
        tokenId: verificationToken._id,
        ipUsed: "unknown",
      });
      
      return {
        success: true,
        message: "Email has been verified successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to verify email",
      };
    }
  },
});

/**
 * Logout user and invalidate session
 */
export const logout = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { token } = args;
    
    try {
      // Invalidate the session
      await ctx.runMutation(internal.users.invalidateUserSession, {
        token,
      });
      
      return {
        success: true,
        message: "Logged out successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: "Logout failed",
      };
    }
  },
});

/**
 * Verify user's authentication token
 * Used to check if a user's session is still valid
 */
export const verifyToken = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { token } = args;
    
    try {
      // Check if session exists and is valid
      const session = await ctx.runQuery(internal.users.getUserSessionByToken, {
        token,
      });
      
      if (!session || !session.isActive) {
        return {
          success: false,
          message: "Invalid session",
        };
      }

      // Check if session has expired
      if (new Date(session.expiresAt) < new Date()) {
        // Invalidate the session
        await ctx.runMutation(internal.users.invalidateUserSession, {
          token,
        });
        
        return {
          success: false,
          message: "Session expired",
        };
      }

      // Update session's last active timestamp
      await ctx.runMutation(internal.users.updateSessionActivity, {
        sessionId: session._id,
      });

      // Get user info
      const user = await ctx.runQuery(internal.users.getUserById, {
        userId: session.userId,
      });
      
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Get enterprise details
      const enterprise = user.enterpriseId
        ? await ctx.runQuery(internal.enterprises.getEnterpriseBasicInfo, {
            enterpriseId: user.enterpriseId,
          })
        : null;

      // Return user data
      return {
        success: true,
        userId: user._id,
        userData: {
          email: user.email,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          role: user.role,
          enterprise: enterprise
            ? {
                name: enterprise.name,
                logo: enterprise.logo,
                primaryColor: enterprise.primaryColor,
                secondaryColor: enterprise.secondaryColor,
              }
            : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to verify session",
      };
    }
  },
});

/**
 * Enable MFA for a user
 */
export const enableMFA = action({
  args: {
    userId: v.id("users"),
    token: v.string(),
    mfaType: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, token, mfaType } = args;
    
    try {
      // Verify the user's session first
      const session = await ctx.runQuery(internal.users.getUserSessionByToken, { token });
      
      if (!session || !session.isActive || session.userId !== userId) {
        return {
          success: false,
          message: "Invalid session",
        };
      }
      
      // Generate MFA secret
      const mfaSecret = generateToken();
      
      // Update user's security preferences
      await ctx.runMutation(internal.users.updateSecurityPreferences, {
        userId,
        securityPreferences: {
          mfaEnabled: true,
          mfaType,
          sessionTimeout: 60, // Default timeout
        },
        mfaSecret,
      });
      
      // Generate recovery codes
      const recoveryCodes = [];
      for (let i = 0; i < 10; i++) {
        const code = generateToken().substring(0, 10);
        recoveryCodes.push(code);
        
        // Store hashed recovery codes
        const hashedCode = await hashPassword(code);
        await ctx.runMutation(internal.users.createMFARecoveryCode, {
          userId,
          code: hashedCode,
          isUsed: false,
          createdAt: new Date().toISOString(),
        });
      }
      
      return {
        success: true,
        message: "MFA enabled successfully",
        recoveryCodes,
        secret: mfaSecret, // This would be used to generate a QR code for TOTP apps
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to enable MFA",
      };
    }
  },
});

/**
 * Generate new API key for programmatic access
 */
export const generateAPIKey = action({
  args: {
    userId: v.id("users"),
    token: v.string(),
    name: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, token, name, permissions, expiresAt } = args;
    
    try {
      // Verify the user's session first
      const session = await ctx.runQuery(internal.users.getUserSessionByToken, { token });
      
      if (!session || !session.isActive || session.userId !== userId) {
        return {
          success: false,
          message: "Invalid session",
        };
      }
      
      // Generate API key
      const apiKey = `api_${generateToken()}`;
      
      // Hash the API key for storage
      const hashedKey = await hashPassword(apiKey);
      
      // Store the API key
      await ctx.runMutation(internal.users.createAPIKey, {
        userId,
        key: hashedKey,
        name,
        permissions,
        isActive: true,
        expiresAt,
        createdAt: new Date().toISOString(),
        useCount: 0,
      });
      
      return {
        success: true,
        message: "API key generated successfully",
        apiKey, // Only time the raw API key is returned to the user
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to generate API key",
      };
    }
  },
});