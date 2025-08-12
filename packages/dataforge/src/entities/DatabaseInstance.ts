import { Entity, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { Organization } from './Organization.js';

@Entity()
export class DatabaseInstance extends BaseSystemEntity {
  @ManyToOne(() => Organization, { fieldName: 'organization_id' })
  organization!: Organization;

  @Property({ type: 'string', nullable: true })
  neonDatabaseId?: string; // Neon database ID for production

  @Property({ type: 'string', nullable: true })
  neonBranchId?: string; // Neon branch ID for production

  @Property({ type: 'string' })
  connectionString!: string;

  @Property({ type: 'string', default: 'provisioning' })
  status!: string; // provisioning, active, error, destroying

  @Property({ type: 'string', default: 'local' })
  environment!: string; // local, production

  @Property({ type: 'json', nullable: true })
  metadata?: any; // Additional database-specific metadata

  @Property({ type: 'string', nullable: true })
  schemaPrefix?: string; // For local development schema-based isolation
}