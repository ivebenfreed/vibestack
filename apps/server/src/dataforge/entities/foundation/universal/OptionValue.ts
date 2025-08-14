/**
 * OptionValue Entity - Polymorphic Option Value Storage System
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Stores option values attached to any entity type with type-safe validation.
 * Supports custom fields, configuration values, settings, preferences, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';
import type { Option, OptionValueType } from './Option';

export interface OptionValueFields extends BaseDomainEntityFields {
  option_id: string;
  target_entity_type: string;
  target_entity_id: string;
  value: any;
  value_type: OptionValueType;
  is_inherited: boolean;
  inherited_from_id: string | null;
  set_by_id: string | null;
  set_at: Date;
  expires_at: Date | null;
  metadata: any;
}

export class OptionValue extends BaseDomainEntity {
  option_id!: string;
  target_entity_type!: string; // project, task, user, organization, etc.
  target_entity_id!: string;
  value?: any; // The actual stored value
  value_type!: OptionValueType; // Denormalized from Option for performance
  is_inherited!: boolean; // Whether value is inherited from parent entity
  inherited_from_id?: string | null; // Source entity for inherited values
  set_by_id?: string | null; // User who set the value
  set_at!: Date;
  expires_at?: Date | null; // For temporary overrides
  metadata?: any; // Additional context and validation state

  constructor(data?: Partial<OptionValueFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'option_value';
    if (!this.set_at) this.set_at = new Date();
    if (this.is_inherited === undefined) this.is_inherited = false;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for OptionValue table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      option_id: 'uuid',
      target_entity_type: 'varchar(50)',
      target_entity_id: 'uuid',
      value: 'jsonb',
      value_type: 'varchar(50)',
      is_inherited: 'boolean',
      inherited_from_id: 'uuid',
      set_by_id: 'uuid',
      set_at: 'timestamptz',
      expires_at: 'timestamptz',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for OptionValue table creation
   */
  static getOptionValueDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "option_value" (
        ${super.getDomainDDL()},
        option_id UUID NOT NULL REFERENCES "option"(id),
        target_entity_type VARCHAR(50) NOT NULL,
        target_entity_id UUID NOT NULL,
        value JSONB,
        value_type VARCHAR(50) NOT NULL,
        is_inherited BOOLEAN DEFAULT FALSE NOT NULL,
        inherited_from_id UUID,
        set_by_id UUID REFERENCES "user"(id),
        set_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT unique_option_value UNIQUE (option_id, target_entity_type, target_entity_id),
        CONSTRAINT chk_expiry_after_set CHECK (expires_at IS NULL OR expires_at > set_at),
        CONSTRAINT chk_inherited_has_source CHECK (
          (is_inherited = FALSE AND inherited_from_id IS NULL) OR 
          (is_inherited = TRUE AND inherited_from_id IS NOT NULL)
        ),
        CONSTRAINT chk_valid_option_value_type CHECK (value_type IN (
          'string', 'number', 'boolean', 'date', 'datetime', 'json', 
          'enum', 'multi_enum', 'email', 'url', 'color', 'file', 'reference'
        ))
      );
    `;
  }

  /**
   * Get the indexes for OptionValue table
   */
  static getOptionValueIndexes(): string[] {
    return [
      ...super.getDomainIndexes('option_value'),
      `CREATE INDEX IF NOT EXISTS idx_option_value_option ON "option_value"(option_id);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_target ON "option_value"(target_entity_type, target_entity_id);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_type ON "option_value"(value_type);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_inherited ON "option_value"(is_inherited);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_inherited_from ON "option_value"(inherited_from_id);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_set_by ON "option_value"(set_by_id);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_set_at ON "option_value"(set_at);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_expires_at ON "option_value"(expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_metadata ON "option_value" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_value ON "option_value" USING GIN(value);`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_active ON "option_value"(target_entity_type, target_entity_id, option_id) WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW());`,
      `CREATE INDEX IF NOT EXISTS idx_option_value_entity_options ON "option_value"(target_entity_type, target_entity_id) WHERE status = 'active';`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): OptionValueFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      option_id: this.option_id,
      target_entity_type: this.target_entity_type,
      target_entity_id: this.target_entity_id,
      value: this.value,
      value_type: this.value_type,
      is_inherited: this.is_inherited || false,
      inherited_from_id: this.inherited_from_id,
      set_by_id: this.set_by_id,
      set_at: this.set_at || new Date(),
      expires_at: this.expires_at,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<OptionValueFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      value: this.value,
      expires_at: this.expires_at,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): OptionValueFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      option_id: this.option_id,
      target_entity_type: this.target_entity_type,
      target_entity_id: this.target_entity_id,
      value: this.value,
      value_type: this.value_type,
      is_inherited: this.is_inherited,
      inherited_from_id: this.inherited_from_id,
      set_by_id: this.set_by_id,
      set_at: this.set_at,
      expires_at: this.expires_at,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if option value is currently active
   */
  isActive(): boolean {
    return this.status === 'active' && !this.isExpired();
  }

  /**
   * Check if option value has expired
   */
  isExpired(): boolean {
    if (!this.expires_at) return false;
    return this.expires_at < new Date();
  }

  /**
   * Check if option value will expire soon (within days)
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
   * Get age of value in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.set_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate value against option definition
   */
  validateValue(option: Option): { valid: boolean; errors: string[] } {
    if (!option) {
      return { valid: false, errors: ['Option definition not found'] };
    }

    return option.validateValue(this.value);
  }

  /**
   * Get typed value based on value_type
   */
  getTypedValue(): any {
    if (this.value === null || this.value === undefined) {
      return null;
    }

    switch (this.value_type) {
      case 'string':
        return String(this.value);
      
      case 'number':
        return Number(this.value);
      
      case 'boolean':
        return Boolean(this.value);
      
      case 'date':
      case 'datetime':
        return this.value instanceof Date ? this.value : new Date(this.value);
      
      case 'json':
        return typeof this.value === 'string' ? JSON.parse(this.value) : this.value;
      
      case 'enum':
      case 'multi_enum':
      case 'email':
      case 'url':
      case 'color':
      case 'file':
      case 'reference':
      default:
        return this.value;
    }
  }

  /**
   * Set value with type validation
   */
  setValue(value: any, option?: Option): { success: boolean; errors: string[] } {
    this.value = value;
    this.set_at = new Date();

    if (option) {
      const validation = this.validateValue(option);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }
    }

    return { success: true, errors: [] };
  }

  /**
   * Check if value was inherited from parent
   */
  isInheritedValue(): boolean {
    return this.is_inherited;
  }

  /**
   * Check if value was set explicitly
   */
  isExplicitValue(): boolean {
    return !this.is_inherited;
  }

  /**
   * Get inheritance source entity
   */
  getInheritanceSource(): { type: string; id: string } | null {
    if (!this.is_inherited || !this.inherited_from_id) {
      return null;
    }

    // In a real implementation, we'd need to track the source entity type
    // For now, assume it's stored in metadata
    const sourceType = this.metadata?.inheritanceSourceType;
    if (!sourceType) return null;

    return {
      type: sourceType,
      id: this.inherited_from_id
    };
  }

  /**
   * Override inherited value
   */
  override(newValue: any, setById?: string): void {
    this.value = newValue;
    this.is_inherited = false;
    this.inherited_from_id = null;
    this.set_by_id = setById || null;
    this.set_at = new Date();
    this.metadata = {
      ...this.metadata,
      wasInherited: true,
      overriddenAt: new Date()
    };
  }

  /**
   * Revert to inherited value
   */
  revertToInherited(inheritedFromId: string, inheritedValue: any): void {
    this.value = inheritedValue;
    this.is_inherited = true;
    this.inherited_from_id = inheritedFromId;
    this.set_at = new Date();
    this.metadata = {
      ...this.metadata,
      revertedAt: new Date()
    };
  }

  /**
   * Extend expiration
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
   * Make permanent (remove expiration)
   */
  makePermanent(): void {
    this.expires_at = null;
  }

  /**
   * Clear value (soft delete)
   */
  clear(): void {
    this.status = 'archived';
    this.metadata = {
      ...this.metadata,
      clearedAt: new Date()
    };
  }

  /**
   * Get value history (if stored in metadata)
   */
  getValueHistory(): Array<{
    value: any;
    setAt: Date;
    setBy?: string;
    reason?: string;
  }> {
    return this.metadata?.history || [];
  }

  /**
   * Add value to history
   */
  addToHistory(reason?: string): void {
    if (!this.metadata) this.metadata = {};
    if (!this.metadata.history) this.metadata.history = [];

    this.metadata.history.push({
      value: this.value,
      setAt: this.set_at,
      setBy: this.set_by_id,
      reason
    });

    // Keep only last 10 entries
    if (this.metadata.history.length > 10) {
      this.metadata.history = this.metadata.history.slice(-10);
    }
  }

  /**
   * Check if value applies to entity
   */
  appliesToEntity(entityType: string, entityId: string): boolean {
    return this.target_entity_type === entityType &&
           this.target_entity_id === entityId &&
           this.isActive();
  }

  /**
   * Get formatted display value
   */
  getDisplayValue(): string {
    const value = this.getTypedValue();
    
    if (value === null || value === undefined) {
      return '';
    }

    switch (this.value_type) {
      case 'boolean':
        return value ? 'Yes' : 'No';
      
      case 'date':
        return value instanceof Date ? value.toLocaleDateString() : String(value);
      
      case 'datetime':
        return value instanceof Date ? value.toLocaleString() : String(value);
      
      case 'multi_enum':
        return Array.isArray(value) ? value.join(', ') : String(value);
      
      case 'json':
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      
      default:
        return String(value);
    }
  }

  /**
   * Get value summary
   */
  getSummary(): {
    optionId: string;
    targetEntity: { type: string; id: string };
    value: any;
    displayValue: string;
    valueType: OptionValueType;
    isInherited: boolean;
    isActive: boolean;
    age: number;
    hasExpiration: boolean;
  } {
    return {
      optionId: this.option_id,
      targetEntity: {
        type: this.target_entity_type,
        id: this.target_entity_id
      },
      value: this.getTypedValue(),
      displayValue: this.getDisplayValue(),
      valueType: this.value_type,
      isInherited: this.is_inherited,
      isActive: this.isActive(),
      age: this.getAge(),
      hasExpiration: !!this.expires_at
    };
  }

  /**
   * Clone value for different entity
   */
  cloneForEntity(entityType: string, entityId: string, setById?: string): OptionValue {
    return new OptionValue({
      option_id: this.option_id,
      target_entity_type: entityType,
      target_entity_id: entityId,
      value: this.value,
      value_type: this.value_type,
      is_inherited: false, // Cloned values are explicit
      set_by_id: setById || this.set_by_id,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: { ...this.metadata, clonedFrom: this.id }
    });
  }

  /**
   * Create bulk option values for multiple entities
   */
  static createBulkValues(
    optionId: string,
    valueType: OptionValueType,
    value: any,
    entities: Array<{ type: string; id: string }>,
    setById?: string
  ): OptionValue[] {
    return entities.map(entity => new OptionValue({
      option_id: optionId,
      target_entity_type: entity.type,
      target_entity_id: entity.id,
      value,
      value_type: valueType,
      set_by_id: setById
    }));
  }

  /**
   * Validate option value data
   */
  static validateOptionValue(data: Partial<OptionValueFields>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.option_id) {
      errors.push('Option ID is required');
    }

    if (!data.target_entity_type) {
      errors.push('Target entity type is required');
    }

    if (!data.target_entity_id) {
      errors.push('Target entity ID is required');
    }

    if (!data.value_type) {
      errors.push('Value type is required');
    }

    if (data.is_inherited && !data.inherited_from_id) {
      errors.push('Inherited values must specify source entity');
    }

    if (data.expires_at && data.set_at && data.expires_at <= data.set_at) {
      errors.push('Expiration date must be after set date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Option Value Utilities
 */
export class OptionValueUtilities {
  /**
   * Filter values by entity
   */
  static filterByEntity(values: OptionValue[], entityType: string, entityId: string): OptionValue[] {
    return values.filter(v => v.appliesToEntity(entityType, entityId));
  }

  /**
   * Filter active values
   */
  static filterActive(values: OptionValue[]): OptionValue[] {
    return values.filter(v => v.isActive());
  }

  /**
   * Filter by option
   */
  static filterByOption(values: OptionValue[], optionId: string): OptionValue[] {
    return values.filter(v => v.option_id === optionId);
  }

  /**
   * Filter inherited values
   */
  static filterInherited(values: OptionValue[]): OptionValue[] {
    return values.filter(v => v.is_inherited);
  }

  /**
   * Filter explicit values
   */
  static filterExplicit(values: OptionValue[]): OptionValue[] {
    return values.filter(v => !v.is_inherited);
  }

  /**
   * Get values expiring soon
   */
  static getExpiringSoon(values: OptionValue[], days: number = 7): OptionValue[] {
    return values.filter(v => v.isExpiringSoon(days));
  }

  /**
   * Group values by entity
   */
  static groupByEntity(values: OptionValue[]): Record<string, OptionValue[]> {
    return values.reduce((groups, value) => {
      const key = `${value.target_entity_type}:${value.target_entity_id}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(value);
      return groups;
    }, {} as Record<string, OptionValue[]>);
  }

  /**
   * Group values by option
   */
  static groupByOption(values: OptionValue[]): Record<string, OptionValue[]> {
    return values.reduce((groups, value) => {
      if (!groups[value.option_id]) {
        groups[value.option_id] = [];
      }
      groups[value.option_id].push(value);
      return groups;
    }, {} as Record<string, OptionValue[]>);
  }

  /**
   * Convert to key-value map for entity
   */
  static toEntityMap(values: OptionValue[], options: Option[]): Record<string, any> {
    const map: Record<string, any> = {};
    const optionMap = new Map(options.map(o => [o.id, o]));

    values.forEach(value => {
      const option = optionMap.get(value.option_id);
      if (option && value.isActive()) {
        map[option.key] = value.getTypedValue();
      }
    });

    return map;
  }

  /**
   * Calculate statistics
   */
  static calculateStats(values: OptionValue[]) {
    const stats = {
      total: values.length,
      active: 0,
      expired: 0,
      inherited: 0,
      explicit: 0,
      expiringSoon: 0,
      byValueType: {} as Record<string, number>,
      byEntityType: {} as Record<string, number>,
      averageAge: 0
    };

    let totalAge = 0;

    values.forEach(value => {
      if (value.isActive()) stats.active++;
      if (value.isExpired()) stats.expired++;
      if (value.is_inherited) stats.inherited++;
      else stats.explicit++;
      if (value.isExpiringSoon()) stats.expiringSoon++;

      stats.byValueType[value.value_type] = (stats.byValueType[value.value_type] || 0) + 1;
      stats.byEntityType[value.target_entity_type] = (stats.byEntityType[value.target_entity_type] || 0) + 1;

      totalAge += value.getAge();
    });

    stats.averageAge = values.length > 0 ? totalAge / values.length : 0;

    return stats;
  }

  /**
   * Find conflicting values (same option, same entity, different values)
   */
  static findConflicts(values: OptionValue[]): OptionValue[][] {
    const groups = new Map<string, OptionValue[]>();
    
    values.forEach(value => {
      const key = `${value.option_id}:${value.target_entity_type}:${value.target_entity_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(value);
    });

    return Array.from(groups.values())
      .filter(group => group.length > 1)
      .filter(group => {
        // Check if values are actually different
        const uniqueValues = new Set(group.map(v => JSON.stringify(v.value)));
        return uniqueValues.size > 1;
      });
  }
}

export default OptionValue;