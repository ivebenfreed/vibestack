/**
 * User Type - Direct Better Auth Schema Mapping
 * 
 * This type directly maps to the Better Auth user table schema.
 * No base entity inheritance - just a simple, direct mapping.
 */

export interface User {
  // Better Auth core fields
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean | null;
  image: string | null;
  role: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  
  // Better Auth security fields
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  password: string | null;
  
  // Organization context fields (our addition)
  default_organization_id: string | null;
  last_used_organization_id: string | null;
  last_org_access_at: Date | null;
}

export interface UserWithOrganization extends User {
  // Joined organization data
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  
  // User's role in the organization
  organization_role?: string;
}

export interface CreateUserData {
  name?: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  role?: string;
  default_organization_id?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
  role?: string;
  default_organization_id?: string;
  last_used_organization_id?: string;
  last_org_access_at?: Date;
}

// Kysely database schema type
export interface UserTable {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean | null;
  image: string | null;
  role: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  password: string | null;
  default_organization_id: string | null;
  last_used_organization_id: string | null;
  last_org_access_at: Date | null;
}