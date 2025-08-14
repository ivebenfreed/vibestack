/**
 * Label Entity - Universal Labeling System
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Provides hierarchical labeling system with color/icon metadata for any entity type.
 * Supports organizational taxonomy, project categories, task priorities, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export interface LabelFields extends BaseDomainEntityFields {
  name: string;
  display_name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parent_label_id: string | null;
  category: string;
  label_type: string;
  sort_order: number;
  is_system_label: boolean;
  is_active: boolean;
  metadata: any;
}

export class Label extends BaseDomainEntity {
  name!: string;
  display_name!: string;
  description?: string | null;
  color?: string | null; // Hex color code or CSS color name
  icon?: string | null; // Icon identifier (e.g., lucide icon names)
  parent_label_id?: string | null; // For hierarchical labels
  category!: string; // priority, status, type, department, etc.
  label_type!: string; // system, custom, imported, generated
  sort_order!: number;
  is_system_label!: boolean;
  is_active!: boolean;
  metadata?: any; // Additional configuration and display options

  constructor(data?: Partial<LabelFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'label';
    if (!this.category) this.category = 'general';
    if (!this.label_type) this.label_type = 'custom';
    if (this.sort_order === undefined) this.sort_order = 100;
    if (this.is_system_label === undefined) this.is_system_label = false;
    if (this.is_active === undefined) this.is_active = true;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for Label table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      name: 'varchar(100)',
      display_name: 'varchar(200)',
      description: 'text',
      color: 'varchar(50)',
      icon: 'varchar(100)',
      parent_label_id: 'uuid',
      category: 'varchar(50)',
      label_type: 'varchar(50)',
      sort_order: 'integer',
      is_system_label: 'boolean',
      is_active: 'boolean',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for Label table creation
   */
  static getLabelDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "label" (
        ${super.getDomainDDL()},
        name VARCHAR(100) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        description TEXT,
        color VARCHAR(50),
        icon VARCHAR(100),
        parent_label_id UUID REFERENCES "label"(id),
        category VARCHAR(50) DEFAULT 'general' NOT NULL,
        label_type VARCHAR(50) DEFAULT 'custom' NOT NULL,
        sort_order INTEGER DEFAULT 100 NOT NULL,
        is_system_label BOOLEAN DEFAULT FALSE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT unique_label_name_per_container UNIQUE (container_type, container_id, category, name),
        CONSTRAINT chk_valid_label_type CHECK (label_type IN ('system', 'custom', 'imported', 'generated')),
        CONSTRAINT chk_valid_color CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$' OR color ~ '^[a-z-]+$'),
        CONSTRAINT chk_no_self_parent CHECK (parent_label_id != id)
      );
    `;
  }

  /**
   * Get the indexes for Label table
   */
  static getLabelIndexes(): string[] {
    return [
      ...super.getDomainIndexes('label'),
      `CREATE INDEX IF NOT EXISTS idx_label_name ON "label"(name);`,
      `CREATE INDEX IF NOT EXISTS idx_label_category ON "label"(category);`,
      `CREATE INDEX IF NOT EXISTS idx_label_type ON "label"(label_type);`,
      `CREATE INDEX IF NOT EXISTS idx_label_parent ON "label"(parent_label_id);`,
      `CREATE INDEX IF NOT EXISTS idx_label_sort_order ON "label"(sort_order);`,
      `CREATE INDEX IF NOT EXISTS idx_label_active ON "label"(is_active);`,
      `CREATE INDEX IF NOT EXISTS idx_label_system ON "label"(is_system_label);`,
      `CREATE INDEX IF NOT EXISTS idx_label_metadata ON "label" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_label_container_category ON "label"(container_type, container_id, category);`,
      `CREATE INDEX IF NOT EXISTS idx_label_hierarchy ON "label"(parent_label_id, sort_order) WHERE parent_label_id IS NOT NULL;`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): LabelFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      name: this.name,
      display_name: this.display_name,
      description: this.description,
      color: this.color,
      icon: this.icon,
      parent_label_id: this.parent_label_id,
      category: this.category,
      label_type: this.label_type || 'custom',
      sort_order: this.sort_order || 100,
      is_system_label: this.is_system_label || false,
      is_active: this.is_active !== false,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<LabelFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      display_name: this.display_name,
      description: this.description,
      color: this.color,
      icon: this.icon,
      parent_label_id: this.parent_label_id,
      sort_order: this.sort_order,
      is_active: this.is_active,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): LabelFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      name: this.name,
      display_name: this.display_name,
      description: this.description,
      color: this.color,
      icon: this.icon,
      parent_label_id: this.parent_label_id,
      category: this.category,
      label_type: this.label_type,
      sort_order: this.sort_order,
      is_system_label: this.is_system_label,
      is_active: this.is_active,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if label is a root label (no parent)
   */
  isRootLabel(): boolean {
    return !this.parent_label_id;
  }

  /**
   * Check if label has children (will be determined by queries)
   */
  hasChildren(): boolean {
    // This would be determined by checking if other labels have this as parent
    return this.metadata?.hasChildren || false;
  }

  /**
   * Get label depth in hierarchy
   */
  getDepth(): number {
    return this.metadata?.depth || 0;
  }

  /**
   * Get full hierarchical path
   */
  getPath(): string[] {
    return this.metadata?.path || [this.name];
  }

  /**
   * Get display path with separators
   */
  getDisplayPath(separator: string = ' > '): string {
    return this.getPath().join(separator);
  }

  /**
   * Check if this label is ancestor of another label
   */
  isAncestorOf(otherLabel: Label): boolean {
    return otherLabel.getPath().includes(this.name);
  }

  /**
   * Check if this label is descendant of another label
   */
  isDescendantOf(otherLabel: Label): boolean {
    return this.getPath().includes(otherLabel.name);
  }

  /**
   * Get computed style object for UI rendering
   */
  getStyle(): {
    backgroundColor?: string;
    color?: string;
    borderColor?: string;
    icon?: string;
  } {
    const style: any = {};
    
    if (this.color) {
      if (this.color.startsWith('#')) {
        style.backgroundColor = this.color;
        // Calculate contrast color for text
        const rgb = parseInt(this.color.slice(1), 16);
        const r = (rgb >> 16) & 255;
        const g = (rgb >> 8) & 255;
        const b = rgb & 255;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        style.color = brightness > 128 ? '#000000' : '#ffffff';
      } else {
        style.backgroundColor = this.color;
      }
    }
    
    if (this.icon) {
      style.icon = this.icon;
    }
    
    return style;
  }

  /**
   * Check if label can be applied to entity type
   */
  canApplyToEntityType(entityType: string): boolean {
    const restrictions = this.metadata?.entityRestrictions;
    if (!restrictions) return true;
    
    if (restrictions.allowedTypes) {
      return restrictions.allowedTypes.includes(entityType);
    }
    
    if (restrictions.excludedTypes) {
      return !restrictions.excludedTypes.includes(entityType);
    }
    
    return true;
  }

  /**
   * Get label usage statistics (would be populated by queries)
   */
  getUsageStats(): {
    totalAssignments: number;
    entityTypes: Record<string, number>;
    lastUsed?: Date;
  } {
    return this.metadata?.usageStats || {
      totalAssignments: 0,
      entityTypes: {},
      lastUsed: undefined
    };
  }

  /**
   * Mark label as deprecated
   */
  deprecate(reason?: string): void {
    this.is_active = false;
    this.metadata = {
      ...this.metadata,
      deprecated: true,
      deprecatedAt: new Date(),
      deprecationReason: reason
    };
  }

  /**
   * Archive label (soft delete)
   */
  archive(): void {
    this.status = 'archived';
    this.is_active = false;
  }

  /**
   * Clone label with new name
   */
  clone(newName: string, newDisplayName?: string): Label {
    return new Label({
      name: newName,
      display_name: newDisplayName || `${this.display_name} (Copy)`,
      description: this.description,
      color: this.color,
      icon: this.icon,
      parent_label_id: this.parent_label_id,
      category: this.category,
      label_type: 'custom', // Cloned labels are always custom
      sort_order: this.sort_order + 1,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: { ...this.metadata, clonedFrom: this.id }
    });
  }

  /**
   * Move label to different parent
   */
  moveTo(newParentId: string | null): void {
    this.parent_label_id = newParentId;
    // Metadata like path and depth would be recalculated by service
  }

  /**
   * Get label summary for API responses
   */
  getSummary(): {
    id: string;
    name: string;
    displayName: string;
    color?: string;
    icon?: string;
    category: string;
    isActive: boolean;
    sortOrder: number;
    depth: number;
    path: string[];
  } {
    return {
      id: this.id,
      name: this.name,
      displayName: this.display_name,
      color: this.color || undefined,
      icon: this.icon || undefined,
      category: this.category,
      isActive: this.is_active,
      sortOrder: this.sort_order,
      depth: this.getDepth(),
      path: this.getPath()
    };
  }
}

export default Label;