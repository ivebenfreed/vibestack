import { Hono } from "hono";
import { getAuth, AuthType } from "../lib/auth";
import { dbLogger } from "../middleware/logger";
import { KyselyUserService } from "../services/KyselyUserService";
import { Resend } from 'resend';

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
        await authInstance.api.sendVerificationOTP({
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

    // Use Kysely-based user deletion with relationship cleanup
    const userService = new KyselyUserService(c);
    
    // First, do a dry run to check for blockers
    const dryRunResult = await userService.deleteWithRelationships(userId, {
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
    const deletionResult = await userService.deleteWithRelationships(userId, {
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
          ? `http://localhost:${c.env.WEB_PORT || '5173'}` 
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

// Invite user (admin only) - Clean one-time token approach
authRouter.post("/admin/users/invite", adminAuthMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { email, name, role } = body;

    if (!email || !name || !role) {
      return c.json({ error: "Missing required fields (email, name, role)." }, 400);
    }

    const validRoles = ['admin', 'member', 'viewer', 'super_admin'];
    if (!validRoles.includes(role)) {
      return c.json({ error: "Invalid role. Must be one of: " + validRoles.join(', ') }, 400);
    }

    const authInstance = getAuth(c);
    
    // Check if user already exists
    const db = authInstance.options.database.db;
    const existingUser = await db
      .selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst();
    
    if (existingUser) {
      return c.json({ error: "User with this email already exists." }, 400);
    }

    // Generate one-time token for signup
    const tokenResult = await authInstance.api.generateOneTimeToken({
      headers: c.req.raw.headers
    });

    if (!tokenResult || !tokenResult.token) {
      dbLogger.error('Failed to generate one-time token');
      return c.json({ error: "Failed to generate invitation token" }, 500);
    }

    // Send invitation email with signup link
    const resend = new Resend(c.env.RESEND_API_KEY);
    const baseUrl = c.env.ENVIRONMENT === "development" 
      ? `http://localhost:${c.env.WEB_PORT || '5173'}`  
      : c.env.ENVIRONMENT === "staging" 
        ? "https://dev.codevibesmatter.com" 
        : "https://app.codevibesmatter.com";

    const signupUrl = `${baseUrl}/sign-up?token=${tokenResult.token}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}&invitedBy=${encodeURIComponent(c.var.user?.email || '')}`;
    
    await resend.emails.send({
      from: 'VibeStack <noreply@codevibesmatter.com>',
      to: email,
      subject: 'Welcome to VibeStack - Create Your Account',
      html: `
        <h1>Welcome to VibeStack!</h1>
        <p>You've been invited to join VibeStack as a <strong>${role}</strong>. Click the link below to create your account:</p>
        <a href="${signupUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 16px 0;">
          Create Your Account
        </a>
        <p><strong>What's next?</strong></p>
        <ul>
          <li>Click the link above to access the signup page</li>
          <li>Choose your own password</li>
          <li>Verify your email address</li>
          <li>Start using VibeStack!</li>
        </ul>
        <p style="color: #666; font-size: 14px;">This invitation link will expire in 24 hours for security. If you have any questions, please contact your administrator.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
      `
    });

    dbLogger.info('User invitation sent with one-time token', { 
      email, 
      role, 
      invitedBy: c.var.user?.email,
      token: tokenResult.token.substring(0, 10) + '...' // Log partial token for debugging
    });

    return c.json({ 
      message: "Invitation sent successfully. User will receive an email with signup instructions.", 
      invitation: {
        email,
        name,
        role,
        expires: "24 hours"
      }
    }, 201);

  } catch (error) {
    dbLogger.error('Error in admin user invitation', error);
    return c.json({ error: "Failed to send user invitation." }, 500);
  }
});


// Handle only POST and GET for other better-auth routes (sign-in, session, etc.)
// This should come AFTER specific routes like /admin/users
authRouter.on(["POST", "GET"], "/*", async (c) => {
  const origin = c.req.header('Origin');
  console.log(`[Auth Router] Handling path: ${c.req.path}, Method: ${c.req.method}, Origin: ${origin}`);
  
  // Add specific logging for OTP endpoints
  if (c.req.path.includes('email-otp') || c.req.path.includes('otp')) {
    console.log('[Auth Router] OTP endpoint detected');
    if (c.req.method === 'POST') {
      try {
        const body = await c.req.text();
        const parsed = JSON.parse(body);
        console.log('[Auth Router] OTP request:', {
          email: parsed.email,
          otpLength: parsed.otp?.length,
          endpoint: c.req.path
        });
        // Create new request with the body we just read
        const request = new Request(c.req.raw.url, {
          method: c.req.method,
          headers: c.req.raw.headers,
          body: body
        });
        c.req.raw = request;
      } catch (e) {
        console.log('[Auth Router] Could not parse OTP request body');
      }
    }
  }

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
    const verifyResult = await authInstance.api.verifyEmailOTP({
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