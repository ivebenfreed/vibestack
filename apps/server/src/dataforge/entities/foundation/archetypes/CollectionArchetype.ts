/**
 * Collection Entity - Cross-Archetype Aggregation and Dashboards
 * 
 * Adapted from archived DataForge archetype definition for server-only implementation.
 * Represents aggregated views, dashboards, reports, and collections that span multiple entity types.
 * Handles dashboards, reports, portfolios, galleries, feeds, etc.
 */

import { BaseDomainEntity } from '../../base/BaseDomainEntity';
import type { BaseDomainEntityFields } from '../../base/BaseDomainEntity';

export type CollectionType = 'dashboard' | 'report' | 'portfolio' | 'gallery' | 'feed' | 'playlist' | 'bookmark_list' | 'search_results' | 'custom';
export type CollectionStatus = 'active' | 'draft' | 'published' | 'archived' | 'deleted';
export type AggregationType = 'manual' | 'filter_based' | 'rule_based' | 'ml_curated' | 'user_curated';
export type RefreshMode = 'manual' | 'real_time' | 'scheduled' | 'on_change';

export interface CollectionFilter {
  entity_type: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value: any;
  logic?: 'AND' | 'OR';
}

export interface CollectionRule {
  name: string;
  description?: string;
  conditions: CollectionFilter[];
  actions?: any[];
  priority: number;
  is_active: boolean;
}

export interface CollectionItem {
  entity_type: string;
  entity_id: string;
  position: number;
  added_at: Date;
  added_by_id?: string;
  metadata?: any;
}

export interface CollectionFields extends BaseDomainEntityFields {
  name: string;
  description: string | null;
  collection_type: CollectionType;
  status: CollectionStatus;
  owner_id: string | null;
  aggregation_type: AggregationType;
  refresh_mode: RefreshMode;
  is_public: boolean;
  is_featured: boolean;
  is_template: boolean;
  template_id: string | null;
  parent_collection_id: string | null;
  items: CollectionItem[];
  filters: CollectionFilter[];
  rules: CollectionRule[];
  sort_config: any;
  view_config: any;
  last_refreshed_at: Date | null;
  refresh_schedule: string | null;
  item_count: number;
  total_views: number;
  last_viewed_at: Date | null;
  tags: string[] | null;
  metadata: any;
}

export class Collection extends BaseDomainEntity {
  name!: string;
  description?: string | null;
  collection_type!: CollectionType;
  status!: CollectionStatus;
  owner_id?: string | null; // Who owns/manages the collection
  aggregation_type!: AggregationType;
  refresh_mode!: RefreshMode;
  is_public!: boolean; // Publicly viewable
  is_featured!: boolean; // Featured on homepage/gallery
  is_template!: boolean; // Can be used as template
  template_id?: string | null; // Created from template
  parent_collection_id?: string | null; // For nested collections
  items!: CollectionItem[]; // Current items in collection
  filters!: CollectionFilter[]; // Filter criteria for auto-population
  rules!: CollectionRule[]; // Business rules for item inclusion
  sort_config?: any; // Sorting configuration
  view_config?: any; // Display/visualization settings
  last_refreshed_at?: Date | null;
  refresh_schedule?: string | null; // Cron expression for scheduled refresh
  item_count!: number; // Cached count for performance
  total_views!: number; // Analytics
  last_viewed_at?: Date | null;
  tags?: string[] | null;
  metadata?: any; // Additional collection context

  constructor(data?: Partial<CollectionFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (!this.archetype) this.archetype = 'collection';
    if (!this.collection_type) this.collection_type = 'custom';
    if (!this.status) this.status = 'draft';
    if (!this.aggregation_type) this.aggregation_type = 'manual';
    if (!this.refresh_mode) this.refresh_mode = 'manual';
    if (this.is_public === undefined) this.is_public = false;
    if (this.is_featured === undefined) this.is_featured = false;
    if (this.is_template === undefined) this.is_template = false;
    if (!this.items) this.items = [];
    if (!this.filters) this.filters = [];
    if (!this.rules) this.rules = [];
    if (!this.item_count) this.item_count = 0;
    if (!this.total_views) this.total_views = 0;
    if (!this.sort_config) this.sort_config = { field: 'created_at', direction: 'desc' };
    if (!this.view_config) this.view_config = { layout: 'grid', columns: 3 };
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for Collection table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      name: 'varchar(500)',
      description: 'text',
      collection_type: 'varchar(50)',
      status: 'varchar(50)',
      owner_id: 'uuid',
      aggregation_type: 'varchar(50)',
      refresh_mode: 'varchar(50)',
      is_public: 'boolean',
      is_featured: 'boolean',
      is_template: 'boolean',
      template_id: 'uuid',
      parent_collection_id: 'uuid',
      items: 'jsonb',
      filters: 'jsonb',
      rules: 'jsonb',
      sort_config: 'jsonb',
      view_config: 'jsonb',
      last_refreshed_at: 'timestamptz',
      refresh_schedule: 'varchar(100)',
      item_count: 'integer',
      total_views: 'integer',
      last_viewed_at: 'timestamptz',
      tags: 'text[]',
      metadata: 'jsonb'
    } as const;
  }

  /**
   * Get the SQL DDL for Collection table creation
   */
  static getCollectionDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "collection" (
        ${super.getDomainDDL()},
        name VARCHAR(500) NOT NULL,
        description TEXT,
        collection_type VARCHAR(50) DEFAULT 'custom' NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' NOT NULL,
        owner_id UUID REFERENCES "user"(id),
        aggregation_type VARCHAR(50) DEFAULT 'manual' NOT NULL,
        refresh_mode VARCHAR(50) DEFAULT 'manual' NOT NULL,
        is_public BOOLEAN DEFAULT FALSE NOT NULL,
        is_featured BOOLEAN DEFAULT FALSE NOT NULL,
        is_template BOOLEAN DEFAULT FALSE NOT NULL,
        template_id UUID REFERENCES "collection"(id),
        parent_collection_id UUID REFERENCES "collection"(id),
        items JSONB DEFAULT '[]' NOT NULL,
        filters JSONB DEFAULT '[]' NOT NULL,
        rules JSONB DEFAULT '[]' NOT NULL,
        sort_config JSONB DEFAULT '{"field": "created_at", "direction": "desc"}' NOT NULL,
        view_config JSONB DEFAULT '{"layout": "grid", "columns": 3}' NOT NULL,
        last_refreshed_at TIMESTAMPTZ,
        refresh_schedule VARCHAR(100),
        item_count INTEGER DEFAULT 0 NOT NULL CHECK (item_count >= 0),
        total_views INTEGER DEFAULT 0 NOT NULL CHECK (total_views >= 0),
        last_viewed_at TIMESTAMPTZ,
        tags TEXT[],
        metadata JSONB DEFAULT '{}' NOT NULL,
        CONSTRAINT chk_collection_type CHECK (collection_type IN ('dashboard', 'report', 'portfolio', 'gallery', 'feed', 'playlist', 'bookmark_list', 'search_results', 'custom')),
        CONSTRAINT chk_collection_status CHECK (status IN ('active', 'draft', 'published', 'archived', 'deleted')),
        CONSTRAINT chk_aggregation_type CHECK (aggregation_type IN ('manual', 'filter_based', 'rule_based', 'ml_curated', 'user_curated')),
        CONSTRAINT chk_refresh_mode CHECK (refresh_mode IN ('manual', 'real_time', 'scheduled', 'on_change')),
        CONSTRAINT chk_name_not_empty CHECK (name != ''),
        CONSTRAINT chk_template_no_parent CHECK (NOT (is_template = TRUE AND parent_collection_id IS NOT NULL)),
        CONSTRAINT chk_scheduled_refresh CHECK (
          (refresh_mode = 'scheduled' AND refresh_schedule IS NOT NULL) OR
          (refresh_mode != 'scheduled')
        )
      );
    `;
  }

  /**
   * Get the indexes for Collection table
   */
  static getCollectionIndexes(): string[] {
    return [
      ...super.getDomainIndexes('collection'),
      `CREATE INDEX IF NOT EXISTS idx_collection_name ON "collection"(name);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_type ON "collection"(collection_type);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_status ON "collection"(status);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_owner ON "collection"(owner_id);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_aggregation_type ON "collection"(aggregation_type);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_refresh_mode ON "collection"(refresh_mode);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_public ON "collection"(is_public) WHERE is_public = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_collection_featured ON "collection"(is_featured) WHERE is_featured = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_collection_template ON "collection"(is_template) WHERE is_template = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_collection_template_id ON "collection"(template_id);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_parent ON "collection"(parent_collection_id);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_items ON "collection" USING GIN(items);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_filters ON "collection" USING GIN(filters);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_rules ON "collection" USING GIN(rules);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_last_refreshed ON "collection"(last_refreshed_at);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_item_count ON "collection"(item_count);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_total_views ON "collection"(total_views);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_last_viewed ON "collection"(last_viewed_at);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_tags ON "collection" USING GIN(tags);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_metadata ON "collection" USING GIN(metadata);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_type_status ON "collection"(collection_type, status);`,
      `CREATE INDEX IF NOT EXISTS idx_collection_owner_type ON "collection"(owner_id, collection_type) WHERE status != 'deleted';`,
      `CREATE INDEX IF NOT EXISTS idx_collection_search ON "collection" USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));`,
      `CREATE INDEX IF NOT EXISTS idx_collection_public_featured ON "collection"(is_public, is_featured, total_views) WHERE status = 'published';`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): CollectionFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      name: this.name,
      description: this.description,
      collection_type: this.collection_type || 'custom',
      status: this.status || 'draft',
      owner_id: this.owner_id,
      aggregation_type: this.aggregation_type || 'manual',
      refresh_mode: this.refresh_mode || 'manual',
      is_public: this.is_public || false,
      is_featured: this.is_featured || false,
      is_template: this.is_template || false,
      template_id: this.template_id,
      parent_collection_id: this.parent_collection_id,
      items: this.items || [],
      filters: this.filters || [],
      rules: this.rules || [],
      sort_config: this.sort_config || { field: 'created_at', direction: 'desc' },
      view_config: this.view_config || { layout: 'grid', columns: 3 },
      last_refreshed_at: this.last_refreshed_at,
      refresh_schedule: this.refresh_schedule,
      item_count: this.item_count || 0,
      total_views: this.total_views || 0,
      last_viewed_at: this.last_viewed_at,
      tags: this.tags,
      metadata: this.metadata || {}
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<CollectionFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      name: this.name,
      description: this.description,
      status: this.status,
      aggregation_type: this.aggregation_type,
      refresh_mode: this.refresh_mode,
      is_public: this.is_public,
      is_featured: this.is_featured,
      items: this.items,
      filters: this.filters,
      rules: this.rules,
      sort_config: this.sort_config,
      view_config: this.view_config,
      last_refreshed_at: this.last_refreshed_at,
      refresh_schedule: this.refresh_schedule,
      item_count: this.item_count,
      total_views: this.total_views,
      last_viewed_at: this.last_viewed_at,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): CollectionFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      name: this.name,
      description: this.description,
      collection_type: this.collection_type,
      status: this.status,
      owner_id: this.owner_id,
      aggregation_type: this.aggregation_type,
      refresh_mode: this.refresh_mode,
      is_public: this.is_public,
      is_featured: this.is_featured,
      is_template: this.is_template,
      template_id: this.template_id,
      parent_collection_id: this.parent_collection_id,
      items: this.items,
      filters: this.filters,
      rules: this.rules,
      sort_config: this.sort_config,
      view_config: this.view_config,
      last_refreshed_at: this.last_refreshed_at,
      refresh_schedule: this.refresh_schedule,
      item_count: this.item_count,
      total_views: this.total_views,
      last_viewed_at: this.last_viewed_at,
      tags: this.tags,
      metadata: this.metadata
    };
  }

  // Business logic methods

  /**
   * Check if collection is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Check if collection is published
   */
  isPublished(): boolean {
    return this.status === 'published';
  }

  /**
   * Check if collection is draft
   */
  isDraft(): boolean {
    return this.status === 'draft';
  }

  /**
   * Check if collection is public
   */
  isPublic(): boolean {
    return this.is_public;
  }

  /**
   * Check if collection is featured
   */
  isFeatured(): boolean {
    return this.is_featured;
  }

  /**
   * Check if collection is template
   */
  isTemplate(): boolean {
    return this.is_template;
  }

  /**
   * Check if collection is manually curated
   */
  isManual(): boolean {
    return this.aggregation_type === 'manual';
  }

  /**
   * Check if collection is automatically populated
   */
  isAutomatic(): boolean {
    return ['filter_based', 'rule_based', 'ml_curated'].includes(this.aggregation_type);
  }

  /**
   * Check if collection needs refresh
   */
  needsRefresh(): boolean {
    if (this.refresh_mode === 'manual') return false;
    if (this.refresh_mode === 'real_time') return false; // Real-time is always current
    
    if (!this.last_refreshed_at) return true;
    
    // Check if scheduled refresh is due
    if (this.refresh_mode === 'scheduled' && this.refresh_schedule) {
      // This would need a proper cron parser in real implementation
      return true; // Simplified
    }
    
    return false;
  }

  /**
   * Add item to collection
   */
  addItem(entityType: string, entityId: string, addedBy?: string, position?: number): boolean {
    // Check if item already exists
    const existingItem = this.items.find(item => 
      item.entity_type === entityType && item.entity_id === entityId
    );
    
    if (existingItem) return false;
    
    const newItem: CollectionItem = {
      entity_type: entityType,
      entity_id: entityId,
      position: position ?? this.items.length,
      added_at: new Date(),
      added_by_id: addedBy,
      metadata: {}
    };
    
    if (position !== undefined) {
      // Insert at specific position
      this.items.splice(position, 0, newItem);
      // Reorder subsequent items
      this.items.forEach((item, index) => {
        if (index > position) {
          item.position = index;
        }
      });
    } else {
      this.items.push(newItem);
    }
    
    this.item_count = this.items.length;
    this.last_refreshed_at = new Date();
    
    return true;
  }

  /**
   * Remove item from collection
   */
  removeItem(entityType: string, entityId: string): boolean {
    const initialLength = this.items.length;
    this.items = this.items.filter(item => 
      !(item.entity_type === entityType && item.entity_id === entityId)
    );
    
    if (this.items.length < initialLength) {
      // Reorder positions
      this.items.forEach((item, index) => {
        item.position = index;
      });
      
      this.item_count = this.items.length;
      this.last_refreshed_at = new Date();
      return true;
    }
    
    return false;
  }

  /**
   * Move item to new position
   */
  moveItem(entityType: string, entityId: string, newPosition: number): boolean {
    const itemIndex = this.items.findIndex(item => 
      item.entity_type === entityType && item.entity_id === entityId
    );
    
    if (itemIndex === -1 || newPosition < 0 || newPosition >= this.items.length) {
      return false;
    }
    
    const [item] = this.items.splice(itemIndex, 1);
    this.items.splice(newPosition, 0, item);
    
    // Update positions
    this.items.forEach((item, index) => {
      item.position = index;
    });
    
    this.last_refreshed_at = new Date();
    return true;
  }

  /**
   * Clear all items
   */
  clearItems(): void {
    this.items = [];
    this.item_count = 0;
    this.last_refreshed_at = new Date();
  }

  /**
   * Get items by entity type
   */
  getItemsByType(entityType: string): CollectionItem[] {
    return this.items.filter(item => item.entity_type === entityType);
  }

  /**
   * Add filter
   */
  addFilter(filter: CollectionFilter): void {
    this.filters.push(filter);
    if (this.aggregation_type === 'filter_based') {
      this.aggregation_type = 'filter_based';
    }
  }

  /**
   * Remove filter
   */
  removeFilter(index: number): boolean {
    if (index >= 0 && index < this.filters.length) {
      this.filters.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = [];
  }

  /**
   * Add rule
   */
  addRule(rule: CollectionRule): void {
    this.rules.push(rule);
    if (this.aggregation_type === 'manual') {
      this.aggregation_type = 'rule_based';
    }
  }

  /**
   * Remove rule
   */
  removeRule(ruleName: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
    return this.rules.length < initialLength;
  }

  /**
   * Update rule
   */
  updateRule(ruleName: string, updates: Partial<CollectionRule>): boolean {
    const rule = this.rules.find(r => r.name === ruleName);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  /**
   * Get active rules
   */
  getActiveRules(): CollectionRule[] {
    return this.rules.filter(rule => rule.is_active).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Update sort configuration
   */
  updateSortConfig(field: string, direction: 'asc' | 'desc'): void {
    this.sort_config = { field, direction };
  }

  /**
   * Update view configuration
   */
  updateViewConfig(config: any): void {
    this.view_config = { ...this.view_config, ...config };
  }

  /**
   * Publish collection
   */
  publish(): boolean {
    if (this.status !== 'draft') return false;
    
    this.status = 'published';
    this.metadata = {
      ...this.metadata,
      publishedAt: new Date()
    };
    
    return true;
  }

  /**
   * Unpublish collection
   */
  unpublish(): boolean {
    if (this.status !== 'published') return false;
    
    this.status = 'active';
    this.metadata = {
      ...this.metadata,
      unpublishedAt: new Date()
    };
    
    return true;
  }

  /**
   * Archive collection
   */
  archive(): void {
    this.status = 'archived';
    this.metadata = {
      ...this.metadata,
      archivedAt: new Date()
    };
  }

  /**
   * Feature collection
   */
  feature(): void {
    this.is_featured = true;
    this.metadata = {
      ...this.metadata,
      featuredAt: new Date()
    };
  }

  /**
   * Unfeature collection
   */
  unfeature(): void {
    this.is_featured = false;
    this.metadata = {
      ...this.metadata,
      unfeaturedAt: new Date()
    };
  }

  /**
   * Set public access
   */
  setPublic(isPublic: boolean): void {
    this.is_public = isPublic;
    this.metadata = {
      ...this.metadata,
      publicAccessChangedAt: new Date(),
      previousPublicState: this.is_public
    };
  }

  /**
   * Refresh collection (apply filters/rules)
   */
  refresh(): void {
    this.last_refreshed_at = new Date();
    
    // In real implementation, this would apply filters and rules
    // to populate items automatically
    
    this.metadata = {
      ...this.metadata,
      lastRefreshType: 'manual',
      refreshedAt: new Date()
    };
  }

  /**
   * Set refresh schedule
   */
  setRefreshSchedule(schedule: string): void {
    this.refresh_schedule = schedule;
    this.refresh_mode = 'scheduled';
  }

  /**
   * Record view
   */
  recordView(): void {
    this.total_views += 1;
    this.last_viewed_at = new Date();
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
   * Check if collection has tag
   */
  hasTag(tag: string): boolean {
    return !!(this.tags && this.tags.includes(tag));
  }

  /**
   * Create template from collection
   */
  createTemplate(templateName: string): Collection {
    return new Collection({
      name: templateName,
      description: this.description,
      collection_type: this.collection_type,
      aggregation_type: this.aggregation_type,
      refresh_mode: this.refresh_mode,
      filters: [...this.filters],
      rules: [...this.rules],
      sort_config: { ...this.sort_config },
      view_config: { ...this.view_config },
      is_template: true,
      owner_id: this.owner_id,
      container_type: this.container_type,
      container_id: this.container_id,
      metadata: {
        ...this.metadata,
        createdFromCollection: this.id,
        templateCreatedAt: new Date()
      }
    });
  }

  /**
   * Create collection from template
   */
  static createFromTemplate(template: Collection, name: string, ownerId: string): Collection {
    if (!template.is_template) {
      throw new Error('Source collection is not a template');
    }
    
    return new Collection({
      name,
      description: template.description,
      collection_type: template.collection_type,
      aggregation_type: template.aggregation_type,
      refresh_mode: template.refresh_mode,
      filters: [...template.filters],
      rules: [...template.rules],
      sort_config: { ...template.sort_config },
      view_config: { ...template.view_config },
      template_id: template.id,
      owner_id: ownerId,
      container_type: template.container_type,
      container_id: template.container_id,
      metadata: {
        createdFromTemplate: template.id,
        templateCreatedAt: new Date()
      }
    });
  }

  /**
   * Clone collection
   */
  clone(newName: string, ownerId?: string): Collection {
    return new Collection({
      ...this.toJSON(),
      id: undefined, // New ID will be generated
      name: newName,
      owner_id: ownerId || this.owner_id,
      status: 'draft',
      is_public: false,
      is_featured: false,
      total_views: 0,
      last_viewed_at: null,
      created_at: undefined,
      updated_at: undefined,
      metadata: {
        ...this.metadata,
        clonedFrom: this.id,
        clonedAt: new Date()
      }
    });
  }

  /**
   * Search collection content
   */
  search(query: string): boolean {
    const searchText = `${this.name} ${this.description || ''} ${this.tags?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Get collection age in days
   */
  getAge(): number {
    const diffTime = new Date().getTime() - this.created_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since last refresh
   */
  getDaysSinceRefresh(): number | null {
    if (!this.last_refreshed_at) return null;
    const diffTime = new Date().getTime() - this.last_refreshed_at.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get popularity score (views per day)
   */
  getPopularityScore(): number {
    const age = this.getAge();
    return age > 0 ? this.total_views / age : this.total_views;
  }

  /**
   * Validate collection
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim() === '') {
      errors.push('Name is required');
    }

    if (this.item_count < 0) {
      errors.push('Item count cannot be negative');
    }

    if (this.total_views < 0) {
      errors.push('Total views cannot be negative');
    }

    if (this.refresh_mode === 'scheduled' && !this.refresh_schedule) {
      errors.push('Scheduled refresh mode requires a schedule');
    }

    if (this.is_template && this.parent_collection_id) {
      errors.push('Templates cannot have parent collections');
    }

    // Validate items have required fields
    for (const item of this.items) {
      if (!item.entity_type || !item.entity_id) {
        errors.push('All items must have entity_type and entity_id');
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get collection summary
   */
  getSummary(): {
    id: string;
    name: string;
    type: string;
    status: string;
    itemCount: number;
    isPublic: boolean;
    isFeatured: boolean;
    isTemplate: boolean;
    isAutomatic: boolean;
    totalViews: number;
    popularityScore: number;
    age: number;
    daysSinceRefresh: number | null;
    hasFilters: boolean;
    hasRules: boolean;
  } {
    return {
      id: this.id,
      name: this.name,
      type: this.collection_type,
      status: this.status,
      itemCount: this.item_count,
      isPublic: this.isPublic(),
      isFeatured: this.isFeatured(),
      isTemplate: this.isTemplate(),
      isAutomatic: this.isAutomatic(),
      totalViews: this.total_views,
      popularityScore: this.getPopularityScore(),
      age: this.getAge(),
      daysSinceRefresh: this.getDaysSinceRefresh(),
      hasFilters: this.filters.length > 0,
      hasRules: this.rules.length > 0
    };
  }

  /**
   * Validate collection data
   */
  static validateCollection(data: Partial<CollectionFields>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!data.name || data.name.trim() === '') {
      errors.push('Name is required');
    }

    const validTypes: CollectionType[] = ['dashboard', 'report', 'portfolio', 'gallery', 'feed', 'playlist', 'bookmark_list', 'search_results', 'custom'];
    if (data.collection_type && !validTypes.includes(data.collection_type)) {
      errors.push('Invalid collection type');
    }

    const validStatuses: CollectionStatus[] = ['active', 'draft', 'published', 'archived', 'deleted'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Invalid collection status');
    }

    const validAggregationTypes: AggregationType[] = ['manual', 'filter_based', 'rule_based', 'ml_curated', 'user_curated'];
    if (data.aggregation_type && !validAggregationTypes.includes(data.aggregation_type)) {
      errors.push('Invalid aggregation type');
    }

    const validRefreshModes: RefreshMode[] = ['manual', 'real_time', 'scheduled', 'on_change'];
    if (data.refresh_mode && !validRefreshModes.includes(data.refresh_mode)) {
      errors.push('Invalid refresh mode');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Collection Utilities for common operations
 */
export class CollectionUtilities {
  /**
   * Filter collections by type
   */
  static filterByType(collections: Collection[], collectionType: CollectionType): Collection[] {
    return collections.filter(c => c.collection_type === collectionType);
  }

  /**
   * Filter published collections
   */
  static filterPublished(collections: Collection[]): Collection[] {
    return collections.filter(c => c.isPublished());
  }

  /**
   * Filter public collections
   */
  static filterPublic(collections: Collection[]): Collection[] {
    return collections.filter(c => c.isPublic());
  }

  /**
   * Filter featured collections
   */
  static filterFeatured(collections: Collection[]): Collection[] {
    return collections.filter(c => c.isFeatured());
  }

  /**
   * Filter templates
   */
  static filterTemplates(collections: Collection[]): Collection[] {
    return collections.filter(c => c.isTemplate());
  }

  /**
   * Filter collections by owner
   */
  static filterByOwner(collections: Collection[], ownerId: string): Collection[] {
    return collections.filter(c => c.owner_id === ownerId);
  }

  /**
   * Filter automatic collections
   */
  static filterAutomatic(collections: Collection[]): Collection[] {
    return collections.filter(c => c.isAutomatic());
  }

  /**
   * Group collections by type
   */
  static groupByType(collections: Collection[]): Record<CollectionType, Collection[]> {
    return collections.reduce((groups, collection) => {
      if (!groups[collection.collection_type]) {
        groups[collection.collection_type] = [];
      }
      groups[collection.collection_type].push(collection);
      return groups;
    }, {} as Record<CollectionType, Collection[]>);
  }

  /**
   * Group collections by owner
   */
  static groupByOwner(collections: Collection[]): Record<string, Collection[]> {
    return collections.reduce((groups, collection) => {
      const ownerId = collection.owner_id || 'unowned';
      if (!groups[ownerId]) {
        groups[ownerId] = [];
      }
      groups[ownerId].push(collection);
      return groups;
    }, {} as Record<string, Collection[]>);
  }

  /**
   * Sort collections by popularity
   */
  static sortByPopularity(collections: Collection[], ascending = false): Collection[] {
    return [...collections].sort((a, b) => {
      const diff = a.getPopularityScore() - b.getPopularityScore();
      return ascending ? diff : -diff;
    });
  }

  /**
   * Sort collections by views
   */
  static sortByViews(collections: Collection[], ascending = false): Collection[] {
    return [...collections].sort((a, b) => {
      const diff = a.total_views - b.total_views;
      return ascending ? diff : -diff;
    });
  }

  /**
   * Sort collections by item count
   */
  static sortByItemCount(collections: Collection[], ascending = false): Collection[] {
    return [...collections].sort((a, b) => {
      const diff = a.item_count - b.item_count;
      return ascending ? diff : -diff;
    });
  }

  /**
   * Search collections
   */
  static search(collections: Collection[], query: string): Collection[] {
    if (!query.trim()) return collections;
    return collections.filter(c => c.search(query));
  }

  /**
   * Get trending collections (high recent activity)
   */
  static getTrending(collections: Collection[], days = 7): Collection[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return collections
      .filter(c => c.last_viewed_at && c.last_viewed_at >= cutoffDate)
      .sort((a, b) => b.getPopularityScore() - a.getPopularityScore());
  }

  /**
   * Get collections needing refresh
   */
  static getNeedingRefresh(collections: Collection[]): Collection[] {
    return collections.filter(c => c.needsRefresh());
  }

  /**
   * Calculate statistics
   */
  static calculateStats(collections: Collection[]) {
    const stats = {
      total: collections.length,
      active: 0,
      published: 0,
      draft: 0,
      public: 0,
      featured: 0,
      templates: 0,
      automatic: 0,
      totalItems: 0,
      totalViews: 0,
      byType: {} as Record<string, number>,
      byAggregationType: {} as Record<string, number>,
      averageItemCount: 0,
      averageViews: 0,
      averageAge: 0
    };

    let totalAge = 0;

    collections.forEach(collection => {
      if (collection.isActive()) stats.active++;
      if (collection.isPublished()) stats.published++;
      if (collection.isDraft()) stats.draft++;
      if (collection.isPublic()) stats.public++;
      if (collection.isFeatured()) stats.featured++;
      if (collection.isTemplate()) stats.templates++;
      if (collection.isAutomatic()) stats.automatic++;

      stats.totalItems += collection.item_count;
      stats.totalViews += collection.total_views;

      stats.byType[collection.collection_type] = (stats.byType[collection.collection_type] || 0) + 1;
      stats.byAggregationType[collection.aggregation_type] = (stats.byAggregationType[collection.aggregation_type] || 0) + 1;

      totalAge += collection.getAge();
    });

    stats.averageItemCount = collections.length > 0 ? stats.totalItems / collections.length : 0;
    stats.averageViews = collections.length > 0 ? stats.totalViews / collections.length : 0;
    stats.averageAge = collections.length > 0 ? totalAge / collections.length : 0;

    return stats;
  }
}

export default Collection;