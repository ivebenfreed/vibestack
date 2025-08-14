/**
 * LabelAssignment Entity - Polymorphic Labeling System
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Provides flexible labeling system that can attach labels to any entity type.
 * Supports tagging, categorization, status tracking, priority assignment, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export interface LabelAssignmentFields extends BaseDomainEntityFields {
  label_id: string;
  target_entity_type: string;
  target_entity_id: string;
  assigned_by_id: string | null;
  assigned_at: Date;
  expires_at: Date | null;
  assignment_reason: string | null;
  is_system_assignment: boolean;
  metadata: any;
}

export class LabelAssignment extends BaseDomainEntity {
  label_id!: string;
  target_entity_type!: string; // project, task, user, file, etc.
  target_entity_id!: string;
  assigned_by_id?: string | null;
  assigned_at!: Date;
  expires_at?: Date | null;
  assignment_reason?: string | null;
  is_system_assignment!: boolean;
  metadata?: any; // Additional assignment context and display options

  constructor(data?: Partial<LabelAssignmentFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'label_assignment';
    if (!this.assigned_at) this.assigned_at = new Date();
    if (this.is_system_assignment === undefined) this.is_system_assignment = false;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for LabelAssignment table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      label_id: 'uuid',
      target_entity_type: 'varchar(50)',
      target_entity_id: 'uuid',
      assigned_by_id: 'uuid',
      assigned_at: 'timestamptz',
      expires_at: 'timestamptz',
      assignment_reason: 'text',
      is_system_assignment: 'boolean',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for LabelAssignment table creation
   */
  static getLabelAssignmentDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "label_assignment" (
        ${super.getDomainDDL()},
        label_id UUID NOT NULL REFERENCES "label"(id),
        target_entity_type VARCHAR(50) NOT NULL,
        target_entity_id UUID NOT NULL,
        assigned_by_id UUID REFERENCES "user"(id),
        assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMPTZ,
        assignment_reason TEXT,
        is_system_assignment BOOLEAN DEFAULT FALSE NOT NULL,
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT unique_label_assignment UNIQUE (label_id, target_entity_type, target_entity_id),
        CONSTRAINT chk_expiry_after_assignment CHECK (expires_at IS NULL OR expires_at > assigned_at)
      );
    `;
  }

  /**
   * Get the indexes for LabelAssignment table
   */
  static getLabelAssignmentIndexes(): string[] {
    return [
      ...super.getDomainIndexes('label_assignment'),
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_label ON "label_assignment"(label_id);`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_target ON "label_assignment"(target_entity_type, target_entity_id);`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_assigned_by ON "label_assignment"(assigned_by_id);`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_assigned_at ON "label_assignment"(assigned_at);`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_expires_at ON "label_assignment"(expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_system ON "label_assignment"(is_system_assignment);`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_metadata ON "label_assignment" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_active ON "label_assignment"(target_entity_type, target_entity_id, label_id) WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW());`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_entity_labels ON "label_assignment"(target_entity_type, target_entity_id) WHERE status = 'active';`,
      `CREATE INDEX IF NOT EXISTS idx_label_assignment_label_entities ON "label_assignment"(label_id) WHERE status = 'active';`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): LabelAssignmentFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      label_id: this.label_id,
      target_entity_type: this.target_entity_type,
      target_entity_id: this.target_entity_id,
      assigned_by_id: this.assigned_by_id,
      assigned_at: this.assigned_at || new Date(),
      expires_at: this.expires_at,
      assignment_reason: this.assignment_reason,
      is_system_assignment: this.is_system_assignment || false,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<LabelAssignmentFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      expires_at: this.expires_at,
      assignment_reason: this.assignment_reason,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): LabelAssignmentFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      label_id: this.label_id,
      target_entity_type: this.target_entity_type,
      target_entity_id: this.target_entity_id,
      assigned_by_id: this.assigned_by_id,
      assigned_at: this.assigned_at,
      expires_at: this.expires_at,
      assignment_reason: this.assignment_reason,
      is_system_assignment: this.is_system_assignment,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if assignment is currently active
   */
  isActive(): boolean {
    return this.status === 'active' && !this.isExpired();
  }

  /**
   * Check if assignment has expired
   */
  isExpired(): boolean {
    if (!this.expires_at) return false;
    return this.expires_at < new Date();
  }

  /**
   * Check if assignment will expire soon (within days)
   */
  isExpiringSoon(days: number = 7): boolean {
    if (!this.expires_at) return false;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + days);
    return this.expires_at <= warningDate && !this.isExpired();
  }

  /**
   * Get days until expiration
   */
  getDaysUntilExpiration(): number | null {
    if (!this.expires_at) return null;
    const diffTime = this.expires_at.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get assignment age in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.assigned_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if assignment was made automatically by system
   */
  isSystemAssignment(): boolean {
    return this.is_system_assignment;
  }

  /**
   * Check if assignment was made manually by user
   */
  isManualAssignment(): boolean {
    return !this.is_system_assignment && !!this.assigned_by_id;
  }

  /**
   * Extend assignment expiration
   */
  extendExpiration(days: number): void {
    if (this.expires_at) {
      const newExpiry = new Date(this.expires_at);
      newExpiry.setDate(newExpiry.getDate() + days);
      this.expires_at = newExpiry;
    } else {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      this.expires_at = expiry;
    }
  }

  /**
   * Remove expiration (make permanent)
   */
  makePermanent(): void {
    this.expires_at = null;
  }

  /**
   * Revoke assignment (soft delete)
   */
  revoke(reason?: string): void {
    this.status = 'archived';
    this.expires_at = new Date(); // Expire immediately
    if (reason) {
      this.assignment_reason = reason;
    }
  }

  /**
   * Update assignment reason
   */
  updateReason(reason: string): void {
    this.assignment_reason = reason;
    this.metadata = {
      ...this.metadata,
      reasonUpdatedAt: new Date()
    };
  }

  /**
   * Add metadata
   */
  addMetadata(key: string, value: any): void {
    if (!this.metadata) this.metadata = {};
    this.metadata[key] = value;
  }

  /**
   * Get metadata value
   */
  getMetadata(key: string): any {
    return this.metadata?.[key];
  }

  /**
   * Check if assignment has specific metadata
   */
  hasMetadata(key: string): boolean {
    return this.metadata && this.metadata[key] !== undefined;
  }

  /**
   * Get assignment priority (if stored in metadata)
   */
  getPriority(): number {
    return this.metadata?.priority || 0;
  }

  /**
   * Set assignment priority
   */
  setPriority(priority: number): void {
    this.addMetadata('priority', priority);
  }

  /**
   * Get assignment confidence score (for ML/auto-assigned labels)
   */
  getConfidenceScore(): number | null {
    return this.metadata?.confidenceScore || null;
  }

  /**
   * Set assignment confidence score
   */
  setConfidenceScore(score: number): void {
    this.addMetadata('confidenceScore', Math.max(0, Math.min(1, score)));
  }

  /**
   * Check if assignment is high confidence (above threshold)
   */
  isHighConfidence(threshold: number = 0.8): boolean {
    const score = this.getConfidenceScore();
    return score !== null && score >= threshold;
  }

  /**
   * Get assignment context (why it was assigned)
   */
  getAssignmentContext(): {
    type: 'manual' | 'system' | 'automatic' | 'imported';
    reason?: string;
    confidence?: number;
    assignedBy?: string;
    assignedAt: Date;
    expiresAt?: Date;
  } {
    return {
      type: this.is_system_assignment ? 'system' : 'manual',
      reason: this.assignment_reason || undefined,
      confidence: this.getConfidenceScore() || undefined,
      assignedBy: this.assigned_by_id || undefined,
      assignedAt: this.assigned_at,
      expiresAt: this.expires_at || undefined
    };
  }

  /**
   * Check if assignment applies to specific entity
   */
  appliesToEntity(entityType: string, entityId: string): boolean {
    return this.target_entity_type === entityType && 
           this.target_entity_id === entityId &&
           this.isActive();
  }

  /**
   * Get formatted assignment summary
   */
  getSummary(): {
    labelId: string;
    targetEntity: { type: string; id: string };
    isActive: boolean;
    isExpired: boolean;
    age: number;
    daysUntilExpiration: number | null;
    isSystemAssignment: boolean;
    hasReason: boolean;
    confidence?: number;
  } {
    return {
      labelId: this.label_id,
      targetEntity: {
        type: this.target_entity_type,
        id: this.target_entity_id
      },
      isActive: this.isActive(),
      isExpired: this.isExpired(),
      age: this.getAge(),
      daysUntilExpiration: this.getDaysUntilExpiration(),
      isSystemAssignment: this.is_system_assignment,
      hasReason: !!this.assignment_reason,
      confidence: this.getConfidenceScore() || undefined
    };
  }

  /**
   * Clone assignment for different entity
   */
  cloneForEntity(entityType: string, entityId: string, assignedBy?: string): LabelAssignment {
    return new LabelAssignment({
      label_id: this.label_id,
      target_entity_type: entityType,
      target_entity_id: entityId,
      assigned_by_id: assignedBy || this.assigned_by_id,
      assignment_reason: this.assignment_reason,
      is_system_assignment: this.is_system_assignment,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: { ...this.metadata, clonedFrom: this.id }
    });
  }

  /**
   * Create bulk assignment data for multiple entities
   */
  static createBulkAssignments(
    labelId: string,
    entities: Array<{ type: string; id: string }>,
    assignedBy?: string,
    options?: {
      reason?: string;
      expiresAt?: Date;
      isSystemAssignment?: boolean;
      metadata?: any;
    }
  ): LabelAssignment[] {
    return entities.map(entity => new LabelAssignment({
      label_id: labelId,
      target_entity_type: entity.type,
      target_entity_id: entity.id,
      assigned_by_id: assignedBy,
      assignment_reason: options?.reason,
      expires_at: options?.expiresAt,
      is_system_assignment: options?.isSystemAssignment || false,
      metadata: options?.metadata || {}
    }));
  }

  /**
   * Validate assignment data
   */
  static validateAssignment(data: Partial<LabelAssignmentFields>): { 
    valid: boolean; 
    errors: string[] 
  } {
    const errors: string[] = [];

    if (!data.label_id) {
      errors.push('Label ID is required');
    }

    if (!data.target_entity_type) {
      errors.push('Target entity type is required');
    }

    if (!data.target_entity_id) {
      errors.push('Target entity ID is required');
    }

    if (data.expires_at && data.assigned_at && data.expires_at <= data.assigned_at) {
      errors.push('Expiration date must be after assignment date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Label Assignment Utilities
 */
export class LabelAssignmentUtilities {
  /**
   * Filter assignments by entity
   */
  static filterByEntity(assignments: LabelAssignment[], entityType: string, entityId: string): LabelAssignment[] {
    return assignments.filter(a => a.appliesToEntity(entityType, entityId));
  }

  /**
   * Filter active assignments
   */
  static filterActive(assignments: LabelAssignment[]): LabelAssignment[] {
    return assignments.filter(a => a.isActive());
  }

  /**
   * Filter by label
   */
  static filterByLabel(assignments: LabelAssignment[], labelId: string): LabelAssignment[] {
    return assignments.filter(a => a.label_id === labelId);
  }

  /**
   * Filter system assignments
   */
  static filterSystemAssignments(assignments: LabelAssignment[]): LabelAssignment[] {
    return assignments.filter(a => a.is_system_assignment);
  }

  /**
   * Filter manual assignments
   */
  static filterManualAssignments(assignments: LabelAssignment[]): LabelAssignment[] {
    return assignments.filter(a => !a.is_system_assignment);
  }

  /**
   * Get assignments expiring soon
   */
  static getExpiringSoon(assignments: LabelAssignment[], days: number = 7): LabelAssignment[] {
    return assignments.filter(a => a.isExpiringSoon(days));
  }

  /**
   * Group assignments by entity
   */
  static groupByEntity(assignments: LabelAssignment[]): Record<string, LabelAssignment[]> {
    return assignments.reduce((groups, assignment) => {
      const key = `${assignment.target_entity_type}:${assignment.target_entity_id}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(assignment);
      return groups;
    }, {} as Record<string, LabelAssignment[]>);
  }

  /**
   * Group assignments by label
   */
  static groupByLabel(assignments: LabelAssignment[]): Record<string, LabelAssignment[]> {
    return assignments.reduce((groups, assignment) => {
      if (!groups[assignment.label_id]) {
        groups[assignment.label_id] = [];
      }
      groups[assignment.label_id].push(assignment);
      return groups;
    }, {} as Record<string, LabelAssignment[]>);
  }

  /**
   * Calculate assignment statistics
   */
  static calculateStats(assignments: LabelAssignment[]) {
    const stats = {
      total: assignments.length,
      active: 0,
      expired: 0,
      expiringSoon: 0,
      system: 0,
      manual: 0,
      byEntityType: {} as Record<string, number>,
      averageAge: 0,
      highConfidence: 0
    };

    let totalAge = 0;

    assignments.forEach(assignment => {
      if (assignment.isActive()) stats.active++;
      if (assignment.isExpired()) stats.expired++;
      if (assignment.isExpiringSoon()) stats.expiringSoon++;
      if (assignment.is_system_assignment) stats.system++;
      else stats.manual++;
      if (assignment.isHighConfidence()) stats.highConfidence++;

      stats.byEntityType[assignment.target_entity_type] = 
        (stats.byEntityType[assignment.target_entity_type] || 0) + 1;

      totalAge += assignment.getAge();
    });

    stats.averageAge = assignments.length > 0 ? totalAge / assignments.length : 0;

    return stats;
  }

  /**
   * Find duplicate assignments
   */
  static findDuplicates(assignments: LabelAssignment[]): LabelAssignment[][] {
    const groups = new Map<string, LabelAssignment[]>();
    
    assignments.forEach(assignment => {
      const key = `${assignment.label_id}:${assignment.target_entity_type}:${assignment.target_entity_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(assignment);
    });

    return Array.from(groups.values()).filter(group => group.length > 1);
  }
}

export default LabelAssignment;