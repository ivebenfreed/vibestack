import { Property, ManyToOne, Entity } from '@mikro-orm/core';
import { BaseDomainEntity } from '../BaseDomainEntity.js';

/**
 * Abstract base class for all collection-related entities
 * Provides common collection fields and aggregation patterns
 * Enables cross-archetype organization and relationship management
 * Concrete entities extend this class with specific implementations
 */
@Entity({ abstract: true })
export abstract class CollectionArchetype extends BaseDomainEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'collection_type' })
  collectionType?: string;

  @Property({ type: 'string', default: 'active' })
  status!: string;

  @Property({ type: 'string', nullable: true })
  visibility?: 'public' | 'private' | 'restricted' | 'internal';

  @Property({ type: 'uuid', nullable: true, fieldName: 'owner_id' })
  ownerId?: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'curator_id' })
  curatorId?: string;

  @Property({ type: 'integer', default: 0, fieldName: 'item_count' })
  itemCount!: number;

  @Property({ type: 'integer', nullable: true, fieldName: 'item_limit' })
  itemLimit?: number;

  @Property({ type: 'date', nullable: true, fieldName: 'last_updated' })
  lastUpdated?: Date;

  // Parent collection for hierarchical organization
  @ManyToOne(() => CollectionArchetype, { nullable: true, fieldName: 'parent_collection_id' })
  parentCollection?: CollectionArchetype;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Property({ type: 'json', nullable: true })
  tags?: string[];

  @Property({ type: 'json', nullable: true, fieldName: 'collection_items' })
  collectionItems?: Array<{
    id: string;
    entityType: string; // project, task, file, activity, discussion, record, document
    entityId: string;
    itemType?: string; // More specific type within archetype
    addedAt: Date;
    addedBy: string;
    position?: number; // For ordered collections
    weight?: number; // For weighted/prioritized collections
    metadata?: Record<string, any>;
    relationships?: Array<{
      relatedItemId: string;
      relationship: 'depends_on' | 'related_to' | 'part_of' | 'similar_to' | 'conflicts_with';
      strength: number; // 0-100
    }>;
    customFields?: Record<string, any>;
    status?: 'active' | 'inactive' | 'pending' | 'archived';
  }>;

  @Property({ type: 'json', nullable: true, fieldName: 'collection_rules' })
  collectionRules?: {
    autoAddRules?: Array<{
      id: string;
      name: string;
      enabled: boolean;
      conditions: Array<{
        field: string;
        operator: 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than' | 'in' | 'not_in';
        value: any;
        entityType?: string;
      }>;
      actions: Array<{
        type: 'add_item' | 'set_metadata' | 'assign_position' | 'notify' | 'trigger_workflow';
        parameters: Record<string, any>;
      }>;
      createdBy: string;
      createdAt: Date;
      lastTriggered?: Date;
      triggerCount: number;
    }>;
    sortRules?: {
      defaultSort: 'added_date' | 'name' | 'priority' | 'position' | 'weight' | 'custom';
      direction: 'asc' | 'desc';
      customSortField?: string;
      groupBy?: string;
      secondarySort?: string;
    };
    validationRules?: Array<{
      rule: 'max_items' | 'unique_items' | 'required_fields' | 'allowed_types' | 'custom';
      parameters: Record<string, any>;
      errorMessage: string;
    }>;
    accessRules?: Array<{
      action: 'view' | 'add' | 'remove' | 'modify' | 'curate';
      userIds?: string[];
      roles?: string[];
      conditions?: Array<{
        field: string;
        operator: string;
        value: any;
      }>;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'aggregation_data' })
  aggregationData?: {
    itemsByType: Record<string, number>; // entityType -> count
    itemsByStatus: Record<string, number>; // status -> count
    totalSize?: number; // Combined size of all items (files, etc.)
    averageScore?: number; // Average quality/health score
    completionRate?: number; // Percentage of completed items
    lastAggregated: Date;
    trends: {
      daily: Record<string, number>; // date -> item count
      weekly: Record<string, number>; // week -> item count
      monthly: Record<string, number>; // month -> item count
    };
    performance: {
      viewCount: number;
      downloadCount: number;
      shareCount: number;
      collaboratorCount: number;
      activityScore: number;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'cross_archetype_analysis' })
  crossArchetypeAnalysis?: {
    archetypeDistribution: Record<string, number>; // archetype -> percentage
    relationshipMap: Array<{
      fromItem: string;
      toItem: string;
      fromType: string;
      toType: string;
      relationship: string;
      strength: number;
    }>;
    clusterAnalysis: Array<{
      clusterId: string;
      items: string[];
      commonAttributes: Record<string, any>;
      clusterScore: number;
      clusterType: 'functional' | 'temporal' | 'user_based' | 'content_based';
    }>;
    dependencies: Array<{
      itemId: string;
      dependsOn: string[];
      dependents: string[];
      criticalityScore: number;
    }>;
    gaps: Array<{
      description: string;
      missingArchetype: string;
      suggestedItems: string[];
      priority: 'low' | 'medium' | 'high';
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'collaboration_settings' })
  collaborationSettings?: {
    allowCollaborators: boolean;
    maxCollaborators?: number;
    collaboratorRoles: Array<{
      role: 'viewer' | 'contributor' | 'editor' | 'curator' | 'admin';
      permissions: string[];
      userIds: string[];
    }>;
    sharingSettings: {
      allowPublicSharing: boolean;
      allowLinkSharing: boolean;
      allowEmbedding: boolean;
      requireAuthentication: boolean;
      expirationDate?: Date;
    };
    workflowSettings: {
      requireApproval: boolean;
      approvers?: string[];
      notificationChannels: string[];
      versionControl: boolean;
      changeTracking: boolean;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'synchronization' })
  synchronization?: {
    syncEnabled: boolean;
    syncSources: Array<{
      sourceId: string;
      sourceType: 'database' | 'api' | 'file' | 'webhook' | 'schedule';
      sourceUrl?: string;
      syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
      lastSync?: Date;
      nextSync?: Date;
      syncStatus: 'active' | 'paused' | 'error' | 'completed';
      errorCount: number;
      lastError?: string;
      mapping: Record<string, string>; // source field -> collection field
    }>;
    conflictResolution: {
      strategy: 'source_wins' | 'target_wins' | 'merge' | 'manual';
      conflictLog: Array<{
        timestamp: Date;
        conflictType: string;
        resolution: string;
        resolvedBy: string;
      }>;
    };
  };

  @Property({ type: 'json', nullable: true, fieldName: 'export_options' })
  exportOptions?: {
    availableFormats: string[]; // 'json', 'csv', 'xml', 'pdf', 'excel'
    exportHistory: Array<{
      exportId: string;
      format: string;
      exportedBy: string;
      exportedAt: Date;
      itemCount: number;
      fileSize?: number;
      downloadCount: number;
      expiresAt?: Date;
    }>;
    scheduledExports: Array<{
      scheduleId: string;
      format: string;
      frequency: 'daily' | 'weekly' | 'monthly';
      recipients: string[];
      filters?: Record<string, any>;
      lastExport?: Date;
      nextExport: Date;
      active: boolean;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'analytics_dashboard' })
  analyticsDashboard?: {
    widgets: Array<{
      widgetId: string;
      type: 'chart' | 'metric' | 'list' | 'table' | 'gauge' | 'map';
      title: string;
      position: { x: number; y: number; width: number; height: number };
      configuration: Record<string, any>;
      dataSource: string;
      refreshInterval: number; // minutes
      lastRefresh?: Date;
    }>;
    layout: 'grid' | 'flow' | 'tabs' | 'accordion';
    permissions: Record<string, string[]>; // role -> widget IDs
    customMetrics: Array<{
      metricId: string;
      name: string;
      formula: string;
      unit?: string;
      description?: string;
    }>;
  };

  @Property({ type: 'json', nullable: true, fieldName: 'ai_insights' })
  aiInsights?: {
    enabled: boolean;
    lastAnalysis?: Date;
    insights: Array<{
      type: 'pattern' | 'anomaly' | 'recommendation' | 'prediction' | 'optimization';
      title: string;
      description: string;
      confidence: number; // 0-100
      impact: 'low' | 'medium' | 'high';
      actionable: boolean;
      suggestedActions?: string[];
      relevantItems?: string[];
      metadata?: Record<string, any>;
      generatedAt: Date;
    }>;
    modelConfig: {
      enabledModels: string[];
      analysisFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
      confidenceThreshold: number;
      maxInsights: number;
    };
    trainingData: {
      useCollectionData: boolean;
      includeUserBehavior: boolean;
      includeExternalData: boolean;
      lastTraining?: Date;
      dataPoints: number;
    };
  };

  // Archetype and container settings - inherited from BaseDomainEntity
  @Property({ persist: false })
  get containerType(): string {
    return 'universal'; // Collections can contain any archetype and belong anywhere
  }

  // Abstract methods that concrete implementations must provide
  abstract getCollectionType(): string;
  abstract validateCollectionRules(): Promise<boolean>;
  abstract processCollectionData(): Promise<void>;
  abstract generateInsights(): Promise<void>;

  // Common collection business logic
  isActive(): boolean {
    return this.status === 'active';
  }

  isFull(): boolean {
    return this.itemLimit ? this.itemCount >= this.itemLimit : false;
  }

  isEmpty(): boolean {
    return this.itemCount === 0;
  }

  hasParent(): boolean {
    return !!this.parentCollection;
  }

  isRootCollection(): boolean {
    return !this.parentCollection;
  }

  // Item management
  addItem(entityType: string, entityId: string, addedBy: string, options?: {
    itemType?: string;
    position?: number;
    weight?: number;
    metadata?: Record<string, any>;
    customFields?: Record<string, any>;
  }): string {
    // Check if collection is full
    if (this.isFull()) {
      throw new Error('Collection has reached its maximum capacity');
    }

    // Check if item already exists
    if (this.hasItem(entityType, entityId)) {
      throw new Error('Item already exists in collection');
    }

    if (!this.collectionItems) {
      this.collectionItems = [];
    }

    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem: NonNullable<CollectionArchetype['collectionItems']>[0] = {
      id: itemId,
      entityType,
      entityId,
      itemType: options?.itemType,
      addedAt: new Date(),
      addedBy,
      position: options?.position ?? this.collectionItems.length,
      weight: options?.weight ?? 1,
      metadata: options?.metadata,
      customFields: options?.customFields,
      status: 'active'
    };

    this.collectionItems.push(newItem);
    this.itemCount++;
    this.lastUpdated = new Date();

    // Update aggregation data
    this.updateAggregationData();

    // Process auto-add rules and relationships
    this.processItemAddition(newItem);

    return itemId;
  }

  removeItem(entityType: string, entityId: string): boolean {
    if (!this.collectionItems) return false;

    const index = this.collectionItems.findIndex(item => 
      item.entityType === entityType && item.entityId === entityId
    );

    if (index === -1) return false;

    this.collectionItems.splice(index, 1);
    this.itemCount--;
    this.lastUpdated = new Date();

    // Update positions for remaining items
    this.reorderItems();

    // Update aggregation data
    this.updateAggregationData();

    return true;
  }

  hasItem(entityType: string, entityId: string): boolean {
    return this.collectionItems?.some(item => 
      item.entityType === entityType && item.entityId === entityId
    ) ?? false;
  }

  getItem(entityType: string, entityId: string): NonNullable<CollectionArchetype['collectionItems']>[0] | undefined {
    return this.collectionItems?.find(item => 
      item.entityType === entityType && item.entityId === entityId
    );
  }

  getItemsByType(entityType: string): NonNullable<CollectionArchetype['collectionItems']> {
    return this.collectionItems?.filter(item => item.entityType === entityType) || [];
  }

  getItemsByStatus(status: NonNullable<CollectionArchetype['collectionItems']>[0]['status']): NonNullable<CollectionArchetype['collectionItems']> {
    return this.collectionItems?.filter(item => item.status === status) || [];
  }

  moveItem(itemId: string, newPosition: number): boolean {
    if (!this.collectionItems) return false;

    const item = this.collectionItems.find(i => i.id === itemId);
    if (!item) return false;

    // Remove item from current position
    const oldIndex = this.collectionItems.indexOf(item);
    this.collectionItems.splice(oldIndex, 1);

    // Insert at new position
    const targetIndex = Math.max(0, Math.min(newPosition, this.collectionItems.length));
    this.collectionItems.splice(targetIndex, 0, item);

    // Update positions
    this.reorderItems();
    this.lastUpdated = new Date();

    return true;
  }

  private reorderItems(): void {
    if (!this.collectionItems) return;

    this.collectionItems.forEach((item, index) => {
      item.position = index;
    });
  }

  private processItemAddition(item: NonNullable<CollectionArchetype['collectionItems']>[0]): void {
    // Process auto-add rules
    this.processAutoAddRules(item);

    // Analyze relationships
    this.analyzeItemRelationships(item);

    // Update cross-archetype analysis
    this.updateCrossArchetypeAnalysis();
  }

  private processAutoAddRules(newItem: NonNullable<CollectionArchetype['collectionItems']>[0]): void {
    const rules = this.collectionRules?.autoAddRules?.filter(rule => rule.enabled) || [];

    for (const rule of rules) {
      const conditionsMet = rule.conditions.every(condition => 
        this.evaluateItemCondition(condition, newItem)
      );

      if (conditionsMet) {
        this.executeRuleActions(rule, newItem);
        rule.lastTriggered = new Date();
        rule.triggerCount++;
      }
    }
  }

  private evaluateItemCondition(condition: any, item: NonNullable<CollectionArchetype['collectionItems']>[0]): boolean {
    const { field, operator, value, entityType } = condition;

    // Check entity type filter
    if (entityType && item.entityType !== entityType) {
      return false;
    }

    let fieldValue: any;

    // Get field value
    switch (field) {
      case 'entityType':
        fieldValue = item.entityType;
        break;
      case 'itemType':
        fieldValue = item.itemType;
        break;
      case 'status':
        fieldValue = item.status;
        break;
      case 'weight':
        fieldValue = item.weight;
        break;
      default:
        fieldValue = item.metadata?.[field] || item.customFields?.[field];
    }

    // Evaluate condition
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(value);
      case 'starts_with':
        return typeof fieldValue === 'string' && fieldValue.startsWith(value);
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > value;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < value;
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      default:
        return false;
    }
  }

  private executeRuleActions(rule: any, item: NonNullable<CollectionArchetype['collectionItems']>[0]): void {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'set_metadata':
          if (!item.metadata) item.metadata = {};
          Object.assign(item.metadata, action.parameters.metadata);
          break;
        case 'assign_position':
          item.position = action.parameters.position;
          break;
        case 'notify':
          console.log(`Notification: ${action.parameters.message}`);
          break;
      }
    }
  }

  private analyzeItemRelationships(newItem: NonNullable<CollectionArchetype['collectionItems']>[0]): void {
    if (!this.collectionItems) return;

    // Find potential relationships with existing items
    const relationships: NonNullable<NonNullable<CollectionArchetype['collectionItems']>[0]['relationships']> = [];

    for (const existingItem of this.collectionItems) {
      if (existingItem.id === newItem.id) continue;

      const relationshipStrength = this.calculateRelationshipStrength(newItem, existingItem);
      
      if (relationshipStrength > 0.3) { // 30% threshold
        const relationshipType = this.determineRelationshipType(newItem, existingItem);
        
        relationships.push({
          relatedItemId: existingItem.id,
          relationship: relationshipType,
          strength: Math.round(relationshipStrength * 100)
        });
      }
    }

    newItem.relationships = relationships;
  }

  private calculateRelationshipStrength(item1: NonNullable<CollectionArchetype['collectionItems']>[0], item2: NonNullable<CollectionArchetype['collectionItems']>[0]): number {
    let strength = 0;

    // Same entity type
    if (item1.entityType === item2.entityType) strength += 0.2;

    // Same item type
    if (item1.itemType === item2.itemType) strength += 0.3;

    // Similar metadata
    const commonMetadataKeys = this.findCommonKeys(item1.metadata || {}, item2.metadata || {});
    strength += commonMetadataKeys.length * 0.1;

    // Similar custom fields
    const commonCustomKeys = this.findCommonKeys(item1.customFields || {}, item2.customFields || {});
    strength += commonCustomKeys.length * 0.1;

    return Math.min(1.0, strength);
  }

  private findCommonKeys(obj1: Record<string, any>, obj2: Record<string, any>): string[] {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    return keys1.filter(key => keys2.includes(key) && obj1[key] === obj2[key]);
  }

  private determineRelationshipType(item1: NonNullable<CollectionArchetype['collectionItems']>[0], item2: NonNullable<CollectionArchetype['collectionItems']>[0]): NonNullable<NonNullable<CollectionArchetype['collectionItems']>[0]['relationships']>[0]['relationship'] {
    // Simple heuristic for relationship type determination
    if (item1.entityType === 'task' && item2.entityType === 'task') {
      return 'depends_on';
    } else if (item1.entityType === item2.entityType) {
      return 'similar_to';
    } else if (item1.entityType === 'project' && item2.entityType === 'task') {
      return 'part_of';
    } else {
      return 'related_to';
    }
  }

  // Aggregation and analytics
  private updateAggregationData(): void {
    if (!this.collectionItems) return;

    const today = new Date().toISOString().split('T')[0];
    
    if (!this.aggregationData) {
      this.aggregationData = {
        itemsByType: {},
        itemsByStatus: {},
        lastAggregated: new Date(),
        trends: {
          daily: {},
          weekly: {},
          monthly: {}
        },
        performance: {
          viewCount: 0,
          downloadCount: 0,
          shareCount: 0,
          collaboratorCount: 0,
          activityScore: 0
        }
      };
    }

    // Count items by type
    this.aggregationData.itemsByType = {};
    this.aggregationData.itemsByStatus = {};
    
    this.collectionItems.forEach(item => {
      // By type
      const type = item.entityType;
      this.aggregationData!.itemsByType[type] = (this.aggregationData!.itemsByType[type] || 0) + 1;
      
      // By status
      const status = item.status || 'active';
      this.aggregationData!.itemsByStatus[status] = (this.aggregationData!.itemsByStatus[status] || 0) + 1;
    });

    // Update trends
    this.aggregationData.trends.daily[today] = this.itemCount;

    // Update completion rate
    const activeItems = this.aggregationData.itemsByStatus['active'] || 0;
    const completedItems = this.aggregationData.itemsByStatus['completed'] || 0;
    const totalItems = activeItems + completedItems;
    this.aggregationData.completionRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    this.aggregationData.lastAggregated = new Date();
  }

  private updateCrossArchetypeAnalysis(): void {
    if (!this.collectionItems) return;

    if (!this.crossArchetypeAnalysis) {
      this.crossArchetypeAnalysis = {
        archetypeDistribution: {},
        relationshipMap: [],
        clusterAnalysis: [],
        dependencies: [],
        gaps: []
      };
    }

    // Calculate archetype distribution
    const totalItems = this.collectionItems.length;
    this.crossArchetypeAnalysis.archetypeDistribution = {};

    this.collectionItems.forEach(item => {
      const archetype = this.mapEntityToArchetype(item.entityType);
      this.crossArchetypeAnalysis!.archetypeDistribution[archetype] = 
        ((this.crossArchetypeAnalysis!.archetypeDistribution[archetype] || 0) / totalItems * 100) + (1 / totalItems * 100);
    });

    // Update relationship map
    this.crossArchetypeAnalysis.relationshipMap = [];
    
    this.collectionItems.forEach(item => {
      if (item.relationships) {
        item.relationships.forEach(rel => {
          const relatedItem = this.collectionItems!.find(i => i.id === rel.relatedItemId);
          if (relatedItem) {
            this.crossArchetypeAnalysis!.relationshipMap.push({
              fromItem: item.id,
              toItem: relatedItem.id,
              fromType: item.entityType,
              toType: relatedItem.entityType,
              relationship: rel.relationship,
              strength: rel.strength
            });
          }
        });
      }
    });

    // Perform cluster analysis
    this.performClusterAnalysis();

    // Analyze dependencies
    this.analyzeDependencies();

    // Identify gaps
    this.identifyGaps();
  }

  private mapEntityToArchetype(entityType: string): string {
    const mapping: Record<string, string> = {
      'project': 'project',
      'software_project': 'project',
      'marketing_campaign': 'project',
      'research_project': 'project',
      'task': 'task',
      'user_story': 'task',
      'bug': 'task',
      'maintenance_task': 'task',
      'file': 'file',
      'source_code': 'file',
      'documentation': 'file',
      'media': 'file',
      'activity': 'activity',
      'deployment': 'activity',
      'testing': 'activity',
      'review': 'activity',
      'discussion': 'discussion',
      'forum': 'discussion',
      'thread': 'discussion',
      'announcement': 'discussion',
      'record': 'record',
      'document': 'document'
    };

    return mapping[entityType] || 'other';
  }

  private performClusterAnalysis(): void {
    if (!this.collectionItems || !this.crossArchetypeAnalysis) return;

    // Simple clustering based on entity types and relationships
    const clusters: Record<string, NonNullable<CollectionArchetype['collectionItems']>> = {};
    
    this.collectionItems.forEach(item => {
      const clusterKey = item.entityType;
      if (!clusters[clusterKey]) {
        clusters[clusterKey] = [];
      }
      clusters[clusterKey].push(item);
    });

    // Convert to cluster analysis format
    this.crossArchetypeAnalysis.clusterAnalysis = Object.entries(clusters).map(([key, items], index) => ({
      clusterId: `cluster-${index}`,
      items: items.map(item => item.id),
      commonAttributes: {
        entityType: key,
        itemCount: items.length
      },
      clusterScore: items.length / this.collectionItems!.length * 100,
      clusterType: 'functional' as const
    }));
  }

  private analyzeDependencies(): void {
    if (!this.collectionItems || !this.crossArchetypeAnalysis) return;

    this.crossArchetypeAnalysis.dependencies = this.collectionItems.map(item => {
      const dependsOn: string[] = [];
      const dependents: string[] = [];

      // Find dependencies from relationships
      if (item.relationships) {
        item.relationships.forEach(rel => {
          if (rel.relationship === 'depends_on') {
            dependsOn.push(rel.relatedItemId);
          }
        });
      }

      // Find items that depend on this item
      this.collectionItems!.forEach(otherItem => {
        if (otherItem.relationships) {
          otherItem.relationships.forEach(rel => {
            if (rel.relatedItemId === item.id && rel.relationship === 'depends_on') {
              dependents.push(otherItem.id);
            }
          });
        }
      });

      // Calculate criticality score
      const criticalityScore = (dependents.length * 2 + dependsOn.length) * 10;

      return {
        itemId: item.id,
        dependsOn,
        dependents,
        criticalityScore: Math.min(100, criticalityScore)
      };
    });
  }

  private identifyGaps(): void {
    if (!this.crossArchetypeAnalysis) return;

    // Simple gap analysis - identify missing archetype coverage
    const presentArchetypes = Object.keys(this.crossArchetypeAnalysis.archetypeDistribution);
    const allArchetypes = ['project', 'task', 'file', 'activity', 'discussion', 'record', 'document'];
    
    const missingArchetypes = allArchetypes.filter(archetype => 
      !presentArchetypes.includes(archetype)
    );

    this.crossArchetypeAnalysis.gaps = missingArchetypes.map(archetype => ({
      description: `Missing ${archetype} items in collection`,
      missingArchetype: archetype,
      suggestedItems: [], // Would be populated with actual suggestions
      priority: 'medium' as const
    }));
  }

  // Sorting and filtering
  sortItems(sortBy: NonNullable<CollectionArchetype['collectionRules']>['sortRules']['defaultSort'], direction: 'asc' | 'desc' = 'asc'): void {
    if (!this.collectionItems) return;

    this.collectionItems.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (sortBy) {
        case 'added_date':
          valueA = a.addedAt.getTime();
          valueB = b.addedAt.getTime();
          break;
        case 'name':
          valueA = a.entityId; // Simplified - would need entity name
          valueB = b.entityId;
          break;
        case 'position':
          valueA = a.position || 0;
          valueB = b.position || 0;
          break;
        case 'weight':
          valueA = a.weight || 0;
          valueB = b.weight || 0;
          break;
        default:
          return 0;
      }

      if (direction === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    // Update positions after sorting
    this.reorderItems();
  }

  filterItems(filters: Record<string, any>): NonNullable<CollectionArchetype['collectionItems']> {
    if (!this.collectionItems) return [];

    return this.collectionItems.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        switch (key) {
          case 'entityType':
            return item.entityType === value;
          case 'itemType':
            return item.itemType === value;
          case 'status':
            return item.status === value;
          case 'addedBy':
            return item.addedBy === value;
          default:
            return item.metadata?.[key] === value || item.customFields?.[key] === value;
        }
      });
    });
  }

  // Access control
  canUserAccess(userId: string, action: string, userRoles: string[] = []): boolean {
    const accessRules = this.collectionRules?.accessRules || [];
    
    // Check specific access rules
    const applicableRules = accessRules.filter(rule => rule.action === action);
    
    if (applicableRules.length === 0) {
      // No specific rules, check ownership
      return this.ownerId === userId || this.curatorId === userId;
    }

    return applicableRules.some(rule => {
      // Check user IDs
      if (rule.userIds && rule.userIds.includes(userId)) return true;
      
      // Check roles
      if (rule.roles && userRoles.some(role => rule.roles!.includes(role))) return true;
      
      // Check conditions (simplified)
      if (rule.conditions) {
        return rule.conditions.every(condition => {
          // Would evaluate conditions against user context
          return true; // Simplified
        });
      }
      
      return false;
    });
  }

  // Metadata and tag management
  setMetadata(key: string, value: any): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
    this.lastUpdated = new Date();
  }

  getMetadata(key: string): any {
    return this.metadata?.[key];
  }

  addTag(tag: string): void {
    if (!this.tags) {
      this.tags = [];
    }
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.lastUpdated = new Date();
    }
  }

  removeTag(tag: string): void {
    if (!this.tags) return;
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.lastUpdated = new Date();
    }
  }

  hasTag(tag: string): boolean {
    return this.tags?.includes(tag) ?? false;
  }

  // Collection health and quality assessment
  getCollectionHealth(): { score: number; factors: Record<string, number>; issues: string[] } {
    const factors: Record<string, number> = {};
    const issues: string[] = [];

    // Content diversity (25%)
    factors.diversity = this.calculateDiversityScore();
    if (factors.diversity < 40) {
      issues.push('Collection lacks archetype diversity');
    }

    // Organization quality (25%)
    factors.organization = this.calculateOrganizationScore();
    if (factors.organization < 60) {
      issues.push('Collection needs better organization and structure');
    }

    // Activity level (25%)
    factors.activity = this.calculateActivityScore();
    if (factors.activity < 30) {
      issues.push('Collection has low activity and engagement');
    }

    // Completeness (25%)
    factors.completeness = this.calculateCompletenessScore();
    if (factors.completeness < 50) {
      issues.push('Collection appears incomplete or has gaps');
    }

    const totalScore = (factors.diversity + factors.organization + factors.activity + factors.completeness) / 4;

    return {
      score: Math.round(totalScore),
      factors,
      issues
    };
  }

  private calculateDiversityScore(): number {
    if (!this.crossArchetypeAnalysis) return 50;

    const archetypeCount = Object.keys(this.crossArchetypeAnalysis.archetypeDistribution).length;
    const maxArchetypes = 7; // Total archetype types
    
    // Calculate balance of distribution
    const distributions = Object.values(this.crossArchetypeAnalysis.archetypeDistribution);
    const balance = this.calculateDistributionBalance(distributions);

    return Math.min(100, (archetypeCount / maxArchetypes) * 60 + balance * 40);
  }

  private calculateDistributionBalance(distributions: number[]): number {
    if (distributions.length === 0) return 0;
    
    const mean = distributions.reduce((sum, val) => sum + val, 0) / distributions.length;
    const variance = distributions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / distributions.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = better balance
    return Math.max(0, 100 - (stdDev * 2));
  }

  private calculateOrganizationScore(): number {
    let score = 50; // Base score

    // Check for tags
    if (this.tags && this.tags.length > 0) score += 15;

    // Check for metadata
    if (this.metadata && Object.keys(this.metadata).length > 0) score += 15;

    // Check for relationships
    const totalRelationships = this.collectionItems?.reduce((sum, item) => 
      sum + (item.relationships?.length || 0), 0) || 0;
    if (totalRelationships > 0) score += 20;

    return Math.min(100, score);
  }

  private calculateActivityScore(): number {
    if (!this.aggregationData) return 30;

    const daysSinceUpdate = this.lastUpdated ? 
      (new Date().getTime() - this.lastUpdated.getTime()) / (1000 * 60 * 60 * 24) : 30;

    let score = Math.max(0, 100 - daysSinceUpdate * 3);

    // Boost for high performance metrics
    const perfMetrics = this.aggregationData.performance;
    score += Math.min(20, (perfMetrics.viewCount + perfMetrics.shareCount) / 10);

    return Math.min(100, score);
  }

  private calculateCompletenessScore(): number {
    let score = 70; // Base score

    // Check for description
    if (!this.description || this.description.length < 50) score -= 15;

    // Check item count vs expectations
    if (this.itemCount === 0) score -= 30;
    else if (this.itemCount < 3) score -= 15;

    // Check for gaps
    const gaps = this.crossArchetypeAnalysis?.gaps?.length || 0;
    score -= gaps * 10;

    return Math.max(0, score);
  }

  // Collection insights and recommendations
  generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const health = this.getCollectionHealth();

    // Diversity recommendations
    if (health.factors.diversity < 50) {
      const missingArchetypes = this.crossArchetypeAnalysis?.gaps?.map(gap => gap.missingArchetype) || [];
      if (missingArchetypes.length > 0) {
        recommendations.push(`Consider adding ${missingArchetypes.slice(0, 2).join(' and ')} items to improve diversity`);
      }
    }

    // Organization recommendations
    if (health.factors.organization < 60) {
      if (!this.tags || this.tags.length === 0) {
        recommendations.push('Add descriptive tags to improve discoverability');
      }
      if (!this.description || this.description.length < 100) {
        recommendations.push('Add a detailed description explaining the collection purpose');
      }
    }

    // Activity recommendations
    if (health.factors.activity < 40) {
      recommendations.push('Increase engagement by sharing the collection and inviting collaborators');
    }

    // Completeness recommendations
    if (health.factors.completeness < 60) {
      recommendations.push('Review collection goals and add missing essential items');
    }

    return recommendations;
  }

  // Common validation that all collections should pass
  async validateCommonRules(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Collection name is required');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Collection name is too long (max 100 characters)');
    }

    if (this.itemLimit && this.itemCount > this.itemLimit) {
      errors.push('Collection exceeds maximum item limit');
    }

    // Validate visibility
    if (this.visibility && !['public', 'private', 'restricted', 'internal'].includes(this.visibility)) {
      errors.push('Invalid visibility setting');
    }

    // Validate items
    if (this.collectionItems) {
      for (const item of this.collectionItems) {
        if (!item.entityType || !item.entityId) {
          errors.push('All collection items must have entityType and entityId');
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Export functionality
  async exportCollection(format: string, options?: {
    includeMetadata?: boolean;
    includeRelationships?: boolean;
    filter?: Record<string, any>;
  }): Promise<string> {
    const items = options?.filter ? this.filterItems(options.filter) : this.collectionItems || [];
    
    const exportData = {
      collection: {
        id: this.id,
        name: this.name,
        description: this.description,
        type: this.collectionType,
        itemCount: items.length,
        metadata: options?.includeMetadata ? this.metadata : undefined
      },
      items: items.map(item => ({
        id: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        itemType: item.itemType,
        addedAt: item.addedAt,
        position: item.position,
        weight: item.weight,
        metadata: options?.includeMetadata ? item.metadata : undefined,
        relationships: options?.includeRelationships ? item.relationships : undefined
      }))
    };

    // Format the export data
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        return this.convertToCSV(exportData.items);
      default:
        return JSON.stringify(exportData, null, 2);
    }
  }

  private convertToCSV(items: any[]): string {
    if (items.length === 0) return '';

    const headers = ['id', 'entityType', 'entityId', 'itemType', 'addedAt', 'position', 'weight'];
    const csvRows = [headers.join(',')];

    items.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        return value ? String(value).replace(/,/g, ';') : '';
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}