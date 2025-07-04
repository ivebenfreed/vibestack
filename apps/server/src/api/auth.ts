import { Hono } from "hono";
import { getAuth, AuthType } from "../lib/auth";
import { dbLogger } from "../middleware/logger";
import { NeonService } from "../lib/neon-orm/neon-service";
import { UserRepository } from "../domains/users";

// Utility to sanitize auth request logging - removes sensitive fields
const sanitizeAuthRequest = (path: string, bodyText: string) => {
  try {
    const body = JSON.parse(bodyText);
    const sensitiveFields = ['password', 'newPassword', 'confirmPassword', 'currentPassword'];
    
    // Create sanitized version
    const sanitized: any = {
      endpoint: path,
      fields: {}
    };
    
    // Check for presence of fields without logging values
    Object.keys(body).forEach(key => {
      if (sensitiveFields.includes(key)) {
        sanitized.fields[key] = '[REDACTED]';
      } else {
        sanitized.fields[key] = body[key];
      }
    });
    
    return sanitized;
  } catch (e) {
    return { endpoint: path, error: 'Could not parse request body' };
  }
};

const authRouter = new Hono<AuthType>();

// Helper function to check admin privileges
const isAdminUser = (user: any): boolean => {
  return user && (user.role === 'admin' || user.role === 'super_admin');
};

// Admin middleware
const adminAuthMiddleware = async (c: any, next: any) => {
  const user = c.var.user;
  const session = c.var.session;

  if (!user || !session) {
    dbLogger.warn('Admin endpoint accessed without valid session');
    return c.json({ error: "Unauthorized: Admin access required. No active session." }, 401);
  }

  if (!isAdminUser(user)) {
    dbLogger.warn('Admin endpoint accessed by non-admin user', { 
      email: user.email, 
      role: user.role 
    });
    return c.json({ error: "Forbidden: Admin privileges required." }, 403);
  }

  await next();
};

// List all users (admin only)
authRouter.get("/admin/users", adminAuthMiddleware, async (c) => {
  try {
    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;
    
    // Query all users directly from database
    const users = await db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'role', 'email_verified', 'created_at', 'updated_at'])
      .orderBy('created_at', 'desc')
      .execute();

    dbLogger.info('Admin users list retrieved', { count: users.length });
    return c.json({ users });

  } catch (error) {
    dbLogger.error('Failed to retrieve users list', error);
    return c.json({ error: "Failed to retrieve users." }, 500);
  }
});

// Create user (admin only)
authRouter.post("/admin/users", adminAuthMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      return c.json({ error: "Missing required fields (email, password, name, role)." }, 400);
    }

    const validRoles = ['admin', 'member', 'viewer', 'super_admin'];
    if (!validRoles.includes(role)) {
      return c.json({ error: "Invalid role. Must be one of: " + validRoles.join(', ') }, 400);
    }

    const authInstance = getAuth(c);
    
    // Create user using Better Auth's signUp method
    const createUserResult = await authInstance.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role
      }
    });

    if (!createUserResult || !createUserResult.user) {
      dbLogger.error('Failed to create user via Better Auth');
      return c.json({ error: "Failed to create user" }, 400);
    }

    dbLogger.info('Admin created new user', { 
      email, 
      role, 
      createdBy: c.var.user?.email 
    });

    return c.json({ 
      message: "User created successfully by admin.", 
      user: {
        id: createUserResult.user?.id,
        email: createUserResult.user?.email,
        name: createUserResult.user?.name,
        role: (createUserResult.user as any)?.role,
        emailVerified: createUserResult.user?.emailVerified
      }
    }, 201);

  } catch (error) {
    dbLogger.error('Error in admin user creation', error);
    return c.json({ error: "Failed to process admin user creation." }, 500);
  }
});

// Update user (admin only)
authRouter.put("/admin/users/:id", adminAuthMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { name, email, role, emailVerified } = body;

    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;

    // Check if email is being changed to an existing email
    if (email !== undefined) {
      const existingUser = await db
        .selectFrom('users')
        .where('email', '=', email)
        .where('id', '!=', userId)
        .selectAll()
        .executeTakeFirst();
      
      if (existingUser) {
        return c.json({ error: "Email address is already in use by another user." }, 400);
      }
    }

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) {
      updateData.email = email;
      // Reset email verification when email changes
      updateData.email_verified = false;
    }
    if (role !== undefined) {
      const validRoles = ['admin', 'member', 'viewer', 'super_admin'];
      if (!validRoles.includes(role)) {
        return c.json({ error: "Invalid role. Must be one of: " + validRoles.join(', ') }, 400);
      }
      updateData.role = role;
    }
    if (emailVerified !== undefined) updateData.email_verified = emailVerified;
    updateData.updated_at = new Date();

    // Update user in database
    const result = await db
      .updateTable('users')
      .set(updateData)
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();
      
    // If email was changed, optionally send OTP verification
    if (email !== undefined && email !== result?.email) {
      try {
        // Send OTP verification to new email address
        await authInstance.api.sendVerificationOtp({
          body: {
            email: email,
            type: 'email-verification'
          }
        });
        
        dbLogger.info('OTP verification sent for email change', {
          userId,
          newEmail: email,
          updatedBy: c.var.user?.email
        });
      } catch (otpError) {
        dbLogger.warn('Failed to send OTP verification for email change', {
          userId,
          newEmail: email,
          error: otpError instanceof Error ? otpError.message : 'Unknown error'
        });
        // Don't fail the entire operation if OTP sending fails
      }
    }

    if (!result) {
      return c.json({ error: "User not found." }, 404);
    }

    dbLogger.info('Admin updated user', { 
      userId, 
      updatedBy: c.var.user?.email,
      changes: updateData 
    });

    return c.json({ 
      message: "User updated successfully.", 
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        role: result.role,
        emailVerified: result.email_verified
      }
    });

  } catch (error) {
    dbLogger.error('Error in admin user update', error);
    return c.json({ error: "Failed to update user." }, 500);
  }
});

// Delete user (admin only) - using UserRepository with automatic relationship cleanup
authRouter.delete("/admin/users/:id", adminAuthMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;

    // Prevent deletion of current user
    if (userId === c.var.user?.id) {
      return c.json({ error: "Cannot delete your own account." }, 400);
    }

    // Check if user exists first
    const user = await db
      .selectFrom('users')
      .where('id', '=', userId)
      .selectAll()
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found." }, 404);
    }

    // Find admin to transfer ownership to (if needed)
    const adminForTransfer = await db
      .selectFrom('users')
      .where('role', 'in', ['admin', 'super_admin'])
      .where('id', '!=', userId)
      .selectAll()
      .executeTakeFirst();

    // Use UserRepository for domain relationship cleanup
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    // First, do a dry run to check for blockers
    const dryRunResult = await userRepo.deleteWithRelationships(userId, {
      transferProjectsTo: adminForTransfer?.id,
      dryRun: true
    });

    if (dryRunResult.blockers.length > 0) {
      const blockerMessages = dryRunResult.blockers.map(b => 
        `${b.entity}.${b.field}: ${b.reason}`
      );
      return c.json({ 
        error: "Cannot delete user due to dependencies: " + blockerMessages.join('; ')
      }, 400);
    }

    // STEP 1: Clean up Better Auth tables FIRST (before domain deletion)
    // These tables have foreign key constraints to users table
    try {
      dbLogger.debug('Starting Better Auth table cleanup', { userId });
      
      // Delete auth-related data that's not tracked by DataForge
      await db
        .deleteFrom('sessions')
        .where('user_id', '=', userId)
        .execute();

      await db
        .deleteFrom('accounts')
        .where('user_id', '=', userId)
        .execute();

      await db
        .deleteFrom('verifications')
        .where('identifier', '=', user.email)
        .execute();
        
      dbLogger.debug('Better Auth table cleanup completed successfully', { userId });
    } catch (authCleanupError) {
      dbLogger.error('Better Auth cleanup failed, aborting user deletion', {
        userId,
        error: authCleanupError instanceof Error ? authCleanupError.message : 'Unknown error'
      });
      return c.json({ 
        error: "Failed to clean up authentication data. User deletion aborted." 
      }, 500);
    }

    // STEP 2: Execute domain deletion (now that auth constraints are removed)
    const deletionResult = await userRepo.deleteWithRelationships(userId, {
      transferProjectsTo: adminForTransfer?.id,
      dryRun: false
    });

    dbLogger.info('Admin deleted user with automatic relationship cleanup', { 
      userId, 
      deletedUser: user.email,
      deletedBy: c.var.user?.email,
      operationsExecuted: deletionResult.operations.length,
      transferredTo: adminForTransfer?.id
    });

    return c.json({ 
      message: "User deleted successfully with automatic relationship cleanup.",
      details: {
        operationsExecuted: deletionResult.operations.length,
        projectsTransferred: !!adminForTransfer,
        transferredTo: adminForTransfer?.email,
        operations: deletionResult.operations.map(op => ({
          type: op.type,
          entity: op.entity,
          action: op.action
        }))
      }
    });

  } catch (error) {
    dbLogger.error('Error in admin user deletion', error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to delete user." 
    }, 500);
  }
});

// Send password reset email (admin only)
authRouter.post("/admin/users/:id/send-reset-email", adminAuthMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;

    // Get user email
    const user = await db
      .selectFrom('users')
      .select(['email'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found." }, 404);
    }

    // Use Better Auth forget password API to send reset email
    const result = await authInstance.api.forgetPassword({
      body: {
        email: user.email,
        redirectTo: `${c.env.ENVIRONMENT === "development" 
          ? "http://localhost:5173" 
          : c.env.ENVIRONMENT === "staging" 
            ? "https://dev.codevibesmatter.com" 
            : "https://app.codevibesmatter.com"}/reset-password`
      }
    });

    if (!result || !result.status) {
      return c.json({ error: "Failed to send reset email" }, 400);
    }

    dbLogger.info('Admin sent password reset email', { 
      userId, 
      userEmail: user.email,
      sentBy: c.var.user?.email 
    });

    return c.json({ message: "Password reset email sent successfully." });

  } catch (error) {
    dbLogger.error('Error sending admin password reset email', error);
    return c.json({ error: "Failed to send reset email." }, 500);
  }
});

// Reset user password (admin only)
authRouter.post("/admin/users/:id/reset-password", adminAuthMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { newPassword } = body;

    if (!newPassword) {
      return c.json({ error: "New password is required." }, 400);
    }

    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;

    // Get user email first
    const user = await db
      .selectFrom('users')
      .select(['email'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found." }, 404);
    }

    // Reset password using direct database update
    // Note: This bypasses Better Auth's password hashing - consider using Better Auth APIs
    // const bcrypt = require('bcrypt'); // TODO: Add bcrypt package
    const hashedPassword = newPassword; // TODO: Add proper hashing
    
    await db
      .updateTable('users')
      .set({ 
        password: hashedPassword,
        updated_at: new Date()
      })
      .where('id', '=', userId)
      .execute();

    dbLogger.info('Admin reset user password', { 
      userId, 
      userEmail: user.email,
      resetBy: c.var.user?.email 
    });

    return c.json({ message: "Password reset successfully." });

  } catch (error) {
    dbLogger.error('Error in admin password reset', error);
    return c.json({ error: "Failed to reset password." }, 500);
  }
});

// Invite user (admin only) - Better Auth recommended pattern
authRouter.post("/admin/users/invite", adminAuthMiddleware, async (c) => {
  let email: string | undefined;
  
  try {
    const body = await c.req.json();
    const extractedData = body;
    email = extractedData.email;
    const { name, role, skipEmailVerification = false } = extractedData;

    if (!email || !name || !role) {
      return c.json({ error: "Missing required fields (email, name, role)." }, 400);
    }

    const validRoles = ['admin', 'member', 'viewer', 'super_admin'];
    if (!validRoles.includes(role)) {
      return c.json({ error: "Invalid role. Must be one of: " + validRoles.join(', ') }, 400);
    }

    const authInstance = getAuth(c);
    
    // Generate random password for initial user creation
    const randomPassword = crypto.randomUUID();
    
    // Step 1: Create user using Better Auth admin plugin
    const createUserResult = await authInstance.api.createUser({
      body: {
        email,
        name,
        password: randomPassword,
        role,
        // Note: emailVerified not supported in createUser body
      }
    });

    if (!createUserResult || !createUserResult.user) {
      dbLogger.error('Failed to create user via Better Auth admin');
      return c.json({ error: "Failed to create user" }, 400);
    }

    // Step 2: Send "password reset" email that's actually an invitation
    const baseUrl = c.env.ENVIRONMENT === "development" 
      ? "http://localhost:5173"  
      : c.env.ENVIRONMENT === "staging" 
        ? "https://dev.codevibesmatter.com" 
        : "https://app.codevibesmatter.com";

    let resetResult;
    try {
      resetResult = await authInstance.api.forgetPassword({
        body: {
          email: email,
          redirectTo: `${baseUrl}/complete-registration`
        }
      });

      if (!resetResult || !resetResult.status) {
        throw new Error('Failed to send invitation email - no result or invalid status');
      }
    } catch (emailError) {
      // Email sending failed - rollback user creation
      dbLogger.error('Invitation email failed, rolling back user creation', {
        email,
        userId: createUserResult.user?.id,
        error: emailError instanceof Error ? emailError.message : 'Unknown error'
      });

      try {
        // Clean up Better Auth tables first, then delete user
        const db = authInstance.options.database.db;
        const userId = createUserResult.user?.id;
        
        // Step 1: Clean up auth-related tables first
        await db.deleteFrom('sessions').where('user_id', '=', userId).execute();
        await db.deleteFrom('accounts').where('user_id', '=', userId).execute();
        await db.deleteFrom('verifications').where('identifier', '=', email).execute();
        
        // Step 2: Now delete the user
        await db
          .deleteFrom('users')
          .where('id', '=', userId)
          .execute();

        dbLogger.info('Successfully rolled back user creation after email failure', {
          email,
          userId
        });
      } catch (rollbackError) {
        dbLogger.error('Failed to rollback user creation after email failure', {
          email,
          userId: createUserResult.user?.id,
          rollbackError: rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error'
        });
      }

      // Return error to user
      return c.json({ 
        error: "Failed to send invitation email. User account was not created." 
      }, 500);
    }

    // Step 3: Update email verification status if requested
    if (skipEmailVerification && createUserResult.user?.id) {
      try {
        const db = authInstance.options.database.db;
        await db
          .updateTable('users')
          .set({ email_verified: true })
          .where('id', '=', createUserResult.user.id)
          .execute();
        
        dbLogger.info('Email verification skipped for invited user', { 
          email, 
          userId: createUserResult.user.id 
        });
      } catch (verificationError) {
        dbLogger.warn('Failed to update email verification status', {
          email,
          userId: createUserResult.user.id,
          error: verificationError instanceof Error ? verificationError.message : 'Unknown error'
        });
      }
    }

    dbLogger.info('Admin invited new user', { 
      email, 
      role, 
      invitedBy: c.var.user?.email,
      skipEmailVerification
    });

    return c.json({ 
      message: "User invitation sent successfully.", 
      user: {
        id: createUserResult.user?.id,
        email: createUserResult.user?.email,
        name: createUserResult.user?.name,
        role: (createUserResult.user as any)?.role,
        emailVerified: skipEmailVerification,
        invited: true
      }
    }, 201);

  } catch (error) {
    dbLogger.error('Error in admin user invitation', error);
    
    // If we have a partially created user, attempt cleanup
    // This catches errors that happen before the email rollback logic
    try {
      const authInstance = getAuth(c);
      const db = authInstance.options.database.db;
      
      // Try to clean up any user that might have been created with this email
      if (email) {
        // Clean up auth tables first
        await db.deleteFrom('sessions').where('user_id', 'in', 
          db.selectFrom('users').select('id').where('email', '=', email)
        ).execute();
        await db.deleteFrom('accounts').where('user_id', 'in',
          db.selectFrom('users').select('id').where('email', '=', email)
        ).execute();
        await db.deleteFrom('verifications').where('identifier', '=', email).execute();
        
        // Then delete the user
        const cleanupResult = await db
          .deleteFrom('users')
          .where('email', '=', email)
          .execute();
        
        // Kysely delete returns an array of DeleteResult objects
        // For simple deletes, we just check if any results were returned
        if (cleanupResult && Array.isArray(cleanupResult) && cleanupResult.length > 0) {
          dbLogger.info('Cleaned up partially created user after general error', {
            email,
            operationsCompleted: cleanupResult.length
          });
        } else {
          dbLogger.debug('No users found to clean up', { email });
        }
      }
    } catch (cleanupError) {
      dbLogger.warn('Could not perform cleanup after invitation error', {
        cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error'
      });
    }

    return c.json({ error: "Failed to process user invitation." }, 500);
  }
});

// Handle only POST and GET for other better-auth routes (sign-in, session, etc.)
// This should come AFTER specific routes like /admin/users
authRouter.on(["POST", "GET"], "/*", async (c) => {
  const origin = c.req.header('Origin');
  console.log(`[Auth Router] Handling path: ${c.req.path}, Method: ${c.req.method}, Origin: ${origin}`);

  // Sanitized logging for auth requests (no sensitive data)
  if (c.req.path.startsWith('/api/auth/') && c.req.method === 'POST') {
    try {
      const bodyText = await c.req.text();
      const sanitizedLog = sanitizeAuthRequest(c.req.path, bodyText);
      console.log('[Auth Router] Request info:', sanitizedLog);
      // Create new request with the body we just read
      const request = new Request(c.req.raw.url, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: bodyText
      });
      c.req.raw = request;
    } catch (e) {
      console.log('[Auth Router] Could not parse auth request body:', e);
    }
  }

  const authInstance = getAuth(c);
  try {
    const request = c.req.raw;
    const url = new URL(request.url);
    url.pathname = c.req.path;
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: request.redirect,
      signal: request.signal,
    });

    const response = await authInstance.handler(modifiedRequest);
    console.log(`[Auth Router] Handler returned response with status: ${response.status}`);
    
    // Log error responses (without sensitive data)
    if (response.status >= 400) {
      console.log(`[Auth Router] Error response for ${c.req.path}: ${response.status} ${response.statusText}`);
    }

    return response;

  } catch (error) {
    console.error("[Auth Router] Error in Better Auth handler:", error);
    // Return a simple error response
    const errorResponse = new Response(JSON.stringify({ error: "Internal Auth Error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return errorResponse;
  }
});

// Verify email change with OTP (user endpoint)
authRouter.post("/verify-email-change", async (c) => {
  try {
    const body = await c.req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return c.json({ error: "Missing required fields (email, otp)." }, 400);
    }

    const authInstance = getAuth(c);
    
    // Verify the OTP
    const verifyResult = await authInstance.api.verifyEmailOtp({
      body: {
        email: email,
        otp: otp
      }
    });

    if (!verifyResult || !verifyResult.status) {
      return c.json({ error: "Invalid or expired OTP code." }, 400);
    }

    // Update the user's email verification status
    const db = authInstance.options.database.db;
    const updateResult = await db
      .updateTable('users')
      .set({ 
        email_verified: true,
        updated_at: new Date()
      })
      .where('email', '=', email)
      .returningAll()
      .executeTakeFirst();

    if (!updateResult) {
      return c.json({ error: "User not found with that email address." }, 404);
    }

    dbLogger.info('Email change verified via OTP', {
      email,
      userId: updateResult.id
    });

    return c.json({ 
      message: "Email verified successfully.",
      user: {
        id: updateResult.id,
        email: updateResult.email,
        emailVerified: updateResult.email_verified
      }
    }, 200);

  } catch (error) {
    dbLogger.error('Error in email change verification', error);
    return c.json({ error: "Failed to verify email change." }, 500);
  }
});

export default authRouter; 