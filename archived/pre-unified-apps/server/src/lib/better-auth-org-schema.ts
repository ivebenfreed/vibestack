/**
 * Better Auth Organization Schema
 * 
 * Extends Better Auth with organization and membership tables.
 * PostgreSQL as absolute source of truth for user-org relationships.
 */

export const organizationSchema = {
  organizations: {
    fields: {
      id: {
        type: "string",
        required: true,
        input: false,
      },
      name: {
        type: "string",
        required: true,
        input: true,
      },
      slug: {
        type: "string",
        required: true,
        input: true,
        unique: true,
      },
      ownerId: {
        type: "string",
        required: true,
        input: true,
        references: {
          model: "user",
          field: "id",
        },
      },
      status: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "active",
      },
      planType: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "free",
      },
      settings: {
        type: "json",
        required: false,
        input: true,
      },
      billing: {
        type: "json",
        required: false,
        input: false,
      },
      createdAt: {
        type: "date",
        required: false,
        input: false,
        defaultValue: () => new Date(),
      },
      updatedAt: {
        type: "date",
        required: false,
        input: false,
        defaultValue: () => new Date(),
      },
    },
  },
  organizationMembers: {
    fields: {
      id: {
        type: "string",
        required: true,
        input: false,
      },
      organizationId: {
        type: "string",
        required: true,
        input: true,
        references: {
          model: "organizations",
          field: "id",
        },
      },
      userId: {
        type: "string",
        required: true,
        input: true,
        references: {
          model: "user",
          field: "id",
        },
      },
      role: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "member",
      },
      status: {
        type: "string",
        required: false,
        input: true,
        defaultValue: "active",
      },
      joinedAt: {
        type: "date",
        required: false,
        input: false,
        defaultValue: () => new Date(),
      },
      lastActiveAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
};

/**
 * SQL DDL for manual creation if needed
 */
export const organizationTables = `
  -- Organizations table
  CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active',
    plan_type VARCHAR(50) DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    billing JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Organization members table  
  CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    status VARCHAR(50) DEFAULT 'active',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id, user_id)
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
  CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
  CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
  CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(organization_id, role);
`;

export type Organization = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: 'active' | 'suspended' | 'deleted';
  planType: 'free' | 'pro' | 'enterprise';
  settings: {
    timeZone?: string;
    currency?: string;
    maxMembers?: number;
    maxEntities?: number;
    workingHours?: {
      start: number;
      end: number;
    };
    workingDays?: number[];
  };
  billing?: {
    customerId: string;
    subscriptionId: string;
    currentPeriodEnd: string;
    usage: {
      entities: number;
      members: number;
      storage: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'active' | 'suspended' | 'pending';
  joinedAt: Date;
  lastActiveAt?: Date;
};