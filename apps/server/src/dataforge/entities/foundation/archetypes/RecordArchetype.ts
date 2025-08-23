/**
 * Record Entity - Knowledge Management and Data Storage
 * 
 * Adapted from archived DataForge archetype definition for server-only implementation.
 * Represents structured data entities with consistent management patterns.
 * Handles core business objects like contacts, companies, products, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export interface RecordFields extends BaseDomainEntityFields {
  name: string;
  description: string | null;
  record_type: string;
  status: string;
  parent_record_id: string | null;
  owner_id: string | null;
  data: any;
  tags: string[] | null;
  external_id: string | null;
  external_source: string | null;
  last_sync_at: Date | null;
  metadata: any;
}

export class Record extends BaseDomainEntity {
  name!: string;
  description?: string | null;
  record_type!: string; // contact, company, product, asset, etc.
  status!: string; // active, inactive, archived, deleted
  parent_record_id?: string | null; // For hierarchical records (Organization → Contacts)
  owner_id?: string | null; // Who manages this record
  data?: any; // Flexible JSON storage for record-specific data
  tags?: string[] | null; // Quick categorization
  external_id?: string | null; // For integration with external systems
  external_source?: string | null; // Source system name
  last_sync_at?: Date | null; // Last external sync
  metadata?: any; // Additional record context

  constructor(data?: Partial<RecordFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'record';
    if (!this.status) this.status = 'active';
    if (!this.data) this.data = {};
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for Record table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      name: 'varchar(255)',
      description: 'text',
      record_type: 'varchar(100)',
      status: 'varchar(50)',
      parent_record_id: 'uuid',
      owner_id: 'uuid',
      data: 'jsonb',
      tags: 'text[]',
      external_id: 'varchar(255)',
      external_source: 'varchar(100)',
      last_sync_at: 'timestamptz',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for Record table creation
   */
  static getRecordDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "record" (
        ${super.getDomainDDL()},
        name VARCHAR(255) NOT NULL,
        description TEXT,
        record_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'active' NOT NULL,
        parent_record_id UUID REFERENCES "record"(id),
        owner_id UUID REFERENCES "user"(id),
        data JSONB DEFAULT '{}' NOT NULL,
        tags TEXT[],
        external_id VARCHAR(255),
        external_source VARCHAR(100),
        last_sync_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT chk_record_status CHECK (status IN ('active', 'inactive', 'archived', 'deleted')),
        CONSTRAINT chk_record_type_not_empty CHECK (record_type != ''),
        CONSTRAINT chk_name_not_empty CHECK (name != ''),
        CONSTRAINT chk_external_sync CHECK (
          (external_id IS NULL AND external_source IS NULL AND last_sync_at IS NULL) OR
          (external_id IS NOT NULL AND external_source IS NOT NULL)
        )
      );
    `;
  }

  /**
   * Get the indexes for Record table
   */
  static getRecordIndexes(): string[] {
    return [
      ...super.getDomainIndexes('record'),
      `CREATE INDEX IF NOT EXISTS idx_record_name ON "record"(name);`,
      `CREATE INDEX IF NOT EXISTS idx_record_type ON "record"(record_type);`,
      `CREATE INDEX IF NOT EXISTS idx_record_status ON "record"(status);`,
      `CREATE INDEX IF NOT EXISTS idx_record_parent ON "record"(parent_record_id);`,
      `CREATE INDEX IF NOT EXISTS idx_record_owner ON "record"(owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_record_external ON "record"(external_source, external_id);`,
      `CREATE INDEX IF NOT EXISTS idx_record_tags ON "record" USING GIN(tags);`,
      `CREATE INDEX IF NOT EXISTS idx_record_data ON "record" USING GIN(data);`,
      `CREATE INDEX IF NOT EXISTS idx_record_metadata ON "record" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_record_type_status ON "record"(record_type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_record_owner_type ON "record"(owner_id, record_type) WHERE status = 'active';`,
      `CREATE INDEX IF NOT EXISTS idx_record_hierarchy ON "record"(parent_record_id, record_type) WHERE status = 'active';`,
      `CREATE INDEX IF NOT EXISTS idx_record_search ON "record" USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): RecordFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      name: this.name,
      description: this.description,
      record_type: this.record_type,
      status: this.status || 'active',
      parent_record_id: this.parent_record_id,
      owner_id: this.owner_id,
      data: this.data || {},
      tags: this.tags,
      external_id: this.external_id,
      external_source: this.external_source,
      last_sync_at: this.last_sync_at,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<RecordFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      name: this.name,
      description: this.description,
      status: this.status,
      parent_record_id: this.parent_record_id,
      owner_id: this.owner_id,
      data: this.data,
      tags: this.tags,
      external_id: this.external_id,
      external_source: this.external_source,
      last_sync_at: this.last_sync_at,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): RecordFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      name: this.name,
      description: this.description,
      record_type: this.record_type,
      status: this.status,
      parent_record_id: this.parent_record_id,
      owner_id: this.owner_id,
      data: this.data,
      tags: this.tags,
      external_id: this.external_id,
      external_source: this.external_source,
      last_sync_at: this.last_sync_at,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if record is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Check if record is archived
   */
  isArchived(): boolean {
    return this.status === 'archived';
  }

  /**
   * Check if record is deleted
   */
  isDeleted(): boolean {
    return this.status === 'deleted';
  }

  /**
   * Check if record has parent
   */
  hasParent(): boolean {
    return !!this.parent_record_id;
  }

  /**
   * Check if record has owner
   */
  hasOwner(): boolean {
    return !!this.owner_id;
  }

  /**
   * Check if record is synced with external system
   */
  isExternallyManaged(): boolean {
    return !!(this.external_id && this.external_source);
  }

  /**
   * Check if record needs sync
   */
  needsSync(): boolean {
    if (!this.isExternallyManaged()) return false;
    
    // If never synced, needs sync
    if (!this.last_sync_at) return true;
    
    // If updated after last sync, needs sync
    return this.updated_at > this.last_sync_at;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): 'not_applicable' | 'up_to_date' | 'needs_sync' | 'never_synced' {
    if (!this.isExternallyManaged()) {
      return 'not_applicable';
    }
    
    if (!this.last_sync_at) {
      return 'never_synced';
    }
    
    if (this.needsSync()) {
      return 'needs_sync';
    }
    
    return 'up_to_date';
  }

  /**
   * Archive record
   */
  archive(): void {
    this.status = 'archived';
    this.metadata = {
      ...this.metadata,
      archivedAt: new Date(),
      archivedReason: 'manual'
    };
  }

  /**
   * Soft delete record
   */
  softDelete(reason?: string): void {
    this.status = 'deleted';
    this.metadata = {
      ...this.metadata,
      deletedAt: new Date(),
      deleteReason: reason || 'manual'
    };
  }

  /**
   * Restore record from archived/deleted
   */
  restore(): void {
    this.status = 'active';
    this.metadata = {
      ...this.metadata,
      restoredAt: new Date(),
      previousStatus: this.status
    };
  }

  /**
   * Update data field
   */
  updateData(key: string, value: any): void {
    if (!this.data) this.data = {};
    this.data[key] = value;
  }

  /**
   * Get data field
   */
  getData(key: string): any {
    return this.data?.[key];
  }

  /**
   * Remove data field
   */
  removeData(key: string): void {
    if (this.data && key in this.data) {
      delete this.data[key];
    }
  }

  /**
   * Add tag
   */
  addTag(tag: string): void {
    if (!this.tags) this.tags = [];
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
    }
  }

  /**
   * Remove tag
   */
  removeTag(tag: string): void {
    if (this.tags) {
      this.tags = this.tags.filter(t => t !== tag);
    }
  }

  /**
   * Check if record has tag
   */
  hasTag(tag: string): boolean {
    return !!(this.tags && this.tags.includes(tag));
  }

  /**
   * Set external sync info
   */
  setExternalSync(externalId: string, source: string): void {
    this.external_id = externalId;
    this.external_source = source;
    this.last_sync_at = new Date();
  }

  /**
   * Mark as synced
   */
  markSynced(): void {
    this.last_sync_at = new Date();
  }

  /**
   * Get age in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.created_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since last sync
   */
  getDaysSinceSync(): number | null {
    if (!this.last_sync_at) return null;
    const diffTime = new Date().getTime() - this.last_sync_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Search in record data
   */
  searchData(query: string): boolean {
    const searchText = `${this.name} ${this.description || ''} ${JSON.stringify(this.data || {})}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Validate record data
   */
  validateData(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim() === '') {
      errors.push('Name is required');
    }

    if (!this.record_type || this.record_type.trim() === '') {
      errors.push('Record type is required');
    }

    if (this.external_id && !this.external_source) {
      errors.push('External source is required when external ID is provided');
    }

    if (this.external_source && !this.external_id) {
      errors.push('External ID is required when external source is provided');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get record summary
   */
  getSummary(): {
    id: string;
    name: string;
    type: string;
    status: string;
    hasParent: boolean;
    hasOwner: boolean;
    isExternallyManaged: boolean;
    syncStatus: string;
    age: number;
    dataKeys: string[];
    tagCount: number;
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.record_type,
      status: this.status,
      hasParent: this.hasParent(),
      hasOwner: this.hasOwner(),
      isExternallyManaged: this.isExternallyManaged(),
      syncStatus: this.getSyncStatus(),
      age: this.getAge(),
      dataKeys: Object.keys(this.data || {}),
      tagCount: this.tags?.length || 0
    };
  }

  /**
   * Clone record with new data
   */
  clone(newData?: Partial<RecordFields>): Record {
    return new Record({
      ...this.toJSON(),
      id: undefined, // New ID will be generated
      created_at: undefined,
      updated_at: undefined,
      external_id: null, // Don't clone external references
      external_source: null,
      last_sync_at: null,
      ...newData
    });
  }

  /**
   * Create bulk records
   */
  static createBulkRecords(
    recordType: string,
    data: Array<{
      name: string;
      description?: string;
      data?: any;
      tags?: string[];
      ownerId?: string;
      parentId?: string;
    }>,
    containerId?: string
  ): Record[] {
    return data.map(item => new Record({
      name: item.name,
      description: item.description,
      record_type: recordType,
      data: item.data || {},
      tags: item.tags,
      owner_id: item.ownerId,
      parent_record_id: item.parentId,
      container_id: containerId
    }));
  }

  /**
   * Validate record data structure
   */
  static validateRecord(data: Partial<RecordFields>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.name || data.name.trim() === '') {
      errors.push('Name is required');
    }

    if (!data.record_type || data.record_type.trim() === '') {
      errors.push('Record type is required');
    }

    if (!['active', 'inactive', 'archived', 'deleted'].includes(data.status || 'active')) {
      errors.push('Status must be active, inactive, archived, or deleted');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Record Utilities for common operations
 */
export class RecordUtilities {
  /**
   * Filter records by type
   */
  static filterByType(records: Record[], recordType: string): Record[] {
    return records.filter(r => r.record_type === recordType);
  }

  /**
   * Filter active records
   */
  static filterActive(records: Record[]): Record[] {
    return records.filter(r => r.isActive());
  }

  /**
   * Filter records by owner
   */
  static filterByOwner(records: Record[], ownerId: string): Record[] {
    return records.filter(r => r.owner_id === ownerId);
  }

  /**
   * Filter records needing sync
   */
  static filterNeedingSync(records: Record[]): Record[] {
    return records.filter(r => r.needsSync());
  }

  /**
   * Group records by type
   */
  static groupByType(records: Record[]): Record<string, Record[]> {
    return records.reduce((groups, record) => {
      if (!groups[record.record_type]) {
        groups[record.record_type] = [];
      }
      groups[record.record_type].push(record);
      return groups;
    }, {} as Record<string, Record[]>);
  }

  /**
   * Group records by owner
   */
  static groupByOwner(records: Record[]): Record<string, Record[]> {
    return records.reduce((groups, record) => {
      const ownerId = record.owner_id || 'unassigned';
      if (!groups[ownerId]) {
        groups[ownerId] = [];
      }
      groups[ownerId].push(record);
      return groups;
    }, {} as Record<string, Record[]>);
  }

  /**
   * Search records
   */
  static search(records: Record[], query: string): Record[] {
    if (!query.trim()) return records;
    return records.filter(r => r.searchData(query));
  }

  /**
   * Calculate statistics
   */
  static calculateStats(records: Record[]) {
    const stats = {
      total: records.length,
      active: 0,
      archived: 0,
      deleted: 0,
      withOwner: 0,
      externallyManaged: 0,
      needingSync: 0,
      byType: {} as Record<string, number>,
      averageAge: 0
    };

    let totalAge = 0;

    records.forEach(record => {
      if (record.isActive()) stats.active++;
      if (record.isArchived()) stats.archived++;
      if (record.isDeleted()) stats.deleted++;
      if (record.hasOwner()) stats.withOwner++;
      if (record.isExternallyManaged()) stats.externallyManaged++;
      if (record.needsSync()) stats.needingSync++;

      stats.byType[record.record_type] = (stats.byType[record.record_type] || 0) + 1;
      totalAge += record.getAge();
    });

    stats.averageAge = records.length > 0 ? totalAge / records.length : 0;

    return stats;
  }
}

export default Record;