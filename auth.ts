import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { Pool } from 'pg';
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from the server's .dev.vars file
config({ path: resolve(__dirname, "apps/server/.dev.vars") });

// Validate required environment variables
const requiredEnvVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
} as const;

// Check if all required environment variables are present
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const auth = betterAuth({
  database: new Pool({
    connectionString: requiredEnvVars.DATABASE_URL as string,
  }),
  secret: requiredEnvVars.BETTER_AUTH_SECRET as string,
  baseUrl: requiredEnvVars.BETTER_AUTH_URL as string,
  emailAndPassword: { enabled: true },
  advanced: {
    database: {
      generateId: false  // Let database generate UUIDs instead of Better Auth text IDs
    }
  },
  plugins: [
    // Better Auth organization plugin for multi-tenant user management
    organization({
      // Allow users to create organizations (can be restricted based on plan)
      allowUserToCreateOrganization: async (user) => {
        // For now, allow all users to create organizations
        // In the future, can restrict based on subscription plan
        return true;
      },
      // Custom invitation email handling
      sendInvitationEmail: async (data) => {
        // For development, log invitation details
        // In production, integrate with email service
        console.log('📧 Organization invitation:', {
          email: data.email,
          organizationName: data.organization.name,
          inviterName: data.inviter.user.name,
          inviterEmail: data.inviter.user.email,
          invitationId: data.id
        });
        
        // TODO: Replace with actual email service integration
        // const inviteLink = `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}`;
        // await sendEmail({
        //   to: data.email,
        //   subject: `You're invited to join ${data.organization.name}`,
        //   template: 'organization-invitation',
        //   data: { inviteLink, organizationName: data.organization.name }
        // });
      }
    })
  ],
  // Use singular table names with consistent snake_case field mapping
  user: {
    modelName: "user",
    fields: {
      id: "id",
      name: "name", 
      email: "email",
      emailVerified: "email_verified",
      image: "image",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  session: {
    modelName: "session",
    fields: {
      id: "id",
      userId: "user_id",
      token: "token",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  account: {
    modelName: "account",
    fields: {
      id: "id",
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      scope: "scope",
      idToken: "id_token",
      password: "password",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  verification: {
    modelName: "verification",
    fields: {
      id: "id",
      identifier: "identifier",
      value: "value",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
}); 