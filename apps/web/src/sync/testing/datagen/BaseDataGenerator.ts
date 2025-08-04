import { v4 as uuidv4 } from 'uuid';

// Domain entity types
export type DomainEntityType = 'users' | 'projects' | 'tasks' | 'comments';

// Base field types
export type FieldType = 'string' | 'email' | 'url' | 'uuid' | 'date' | 'boolean' | 'array' | 'enum' | 'tsrange' | 'interval' | 'number' | 'integer';

// Entity schema definition
export interface EntitySchema {
  requiredFields: Record<string, FieldType>;
  optionalFields: Record<string, FieldType>;
  relationships: {
    belongsTo?: Array<{ field: string; entity: DomainEntityType; required?: boolean }>;
    hasMany?: Array<{ field: string; entity: DomainEntityType }>;
    manyToMany?: Array<{ field: string; entity: DomainEntityType; joinTable: string }>;
  };
  enums: Record<string, any>;
  constraints: {
    unique?: string[];
    maxLength?: Record<string, number>;
    patterns?: Record<string, RegExp>;
  };
}

// Generation options
export interface GenerationOptions {
  variation?: 'minimal' | 'basic' | 'complete';
  relationships?: Record<string, any[]>;
  overrides?: Record<string, any>;
}

/**
 * Base class for all entity data generators
 * Provides common functionality and utilities
 */
export abstract class BaseDataGenerator {
  protected abstract entityType: DomainEntityType;
  protected abstract schema: EntitySchema;

  /**
   * Generate raw data objects without calling services
   */
  async generateRawData(count: number = 1, options: GenerationOptions = {}): Promise<any[]> {
    const { variation = 'complete', relationships = {}, overrides = {} } = options;
    const entities = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const entityData = await this.generateEntityData(variation, relationships, overrides, i);
        
        // Add UUID if not present
        if (!entityData.id) {
          entityData.id = uuidv4();
        }

        // Add timestamps if not present
        if (!entityData.createdAt) {
          entityData.createdAt = new Date();
        }
        if (!entityData.updatedAt) {
          entityData.updatedAt = new Date();
        }
        
        console.log(`[${this.entityType}Generator] Generated raw ${this.entityType} #${i + 1} with id: ${entityData.id}`);
        
        entities.push(entityData);
      } catch (error) {
        console.error(`[${this.entityType}Generator] Error generating raw ${this.entityType} #${i + 1}:`, error);
        throw error;
      }
    }

    return entities;
  }

  /**
   * Generate entity data according to schema
   */
  private async generateEntityData(
    variation: string,
    relationships: Record<string, any[]>,
    overrides: Record<string, any>,
    index: number
  ): Promise<any> {
    const data: any = { ...overrides };

    // Handle required fields
    for (const [field, type] of Object.entries(this.schema.requiredFields)) {
      if (data[field] === undefined) {
        data[field] = await this.generateFieldValue(field, type, index, relationships);
      }
    }

    // Handle optional fields based on variation
    if (variation !== 'minimal') {
      for (const [field, type] of Object.entries(this.schema.optionalFields)) {
        if (data[field] === undefined && (variation === 'complete' || Math.random() > 0.3)) {
          data[field] = await this.generateFieldValue(field, type, index, relationships);
        }
      }
    }

    // Handle relationships
    await this.handleRelationships(data, relationships);

    return data;
  }

  /**
   * Generate field value based on type
   */
  protected async generateFieldValue(
    field: string,
    type: FieldType,
    index: number,
    relationships: Record<string, any[]>
  ): Promise<any> {
    switch (type) {
      case 'string':
        return this.generateStringValue(field, index);
      case 'email':
        return this.generateEmailValue(index);
      case 'url':
        return this.generateUrlValue(field, index);
      case 'uuid':
        return this.generateUuidReference(field, relationships);
      case 'date':
        return this.generateDateValue(field);
      case 'boolean':
        return Math.random() > 0.5;
      case 'array':
        return this.generateArrayValue(field);
      case 'enum':
        return this.generateEnumValue(field);
      case 'tsrange':
        return this.generateTsRangeValue(field);
      case 'interval':
        return this.generateIntervalValue(field);
      case 'number':
      case 'integer':
        return this.generateNumberValue(field, type);
      default:
        console.warn(`[${this.entityType}Generator] Unknown field type "${type}" for field "${field}", returning null`);
        return null;
    }
  }

  /**
   * Handle relationships for the entity
   */
  private async handleRelationships(
    data: any,
    relationships: Record<string, any[]>
  ): Promise<void> {
    if (this.schema.relationships.belongsTo) {
      for (const relation of this.schema.relationships.belongsTo) {
        const relationField = relation.field + 'Id';
        
        if (data[relationField] === undefined) {
          if (relationships[relation.entity] && relationships[relation.entity].length > 0) {
            const relatedEntity = this.getRandomItem(relationships[relation.entity]);
            data[relationField] = relatedEntity.id;
          } else if (relation.required) {
            console.warn(`[${this.entityType}Generator] Required relationship ${relation.entity} not provided, setting ${relationField} to null`);
            data[relationField] = null;
          }
        }
      }
    }
  }

  // Field generation methods (can be overridden by subclasses)
  protected generateStringValue(field: string, index: number): string {
    const templates = this.getStringTemplates(field);
    const template = templates[index % templates.length];
    const maxLength = this.schema.constraints?.maxLength?.[field] || 255;
    
    const isUnique = this.schema.constraints?.unique?.includes(field);
    
    const baseValue = template
      .replace('{{index}}', String(index + 1))
      .replace('{{timestamp}}', String(Date.now()));
    
    const randomSuffix = isUnique ? `_${Math.floor(Math.random() * 10000)}_${Date.now()}` : '';
    let value = baseValue + randomSuffix;
    
    if (value.length > maxLength) {
      if (isUnique) {
        const minUniqueLength = 10;
        const availableLength = Math.max(maxLength - minUniqueLength, 5);
        const shortRandomSuffix = `_${Math.floor(Math.random() * 1000)}`;
        value = baseValue.substring(0, availableLength) + shortRandomSuffix;
        
        if (value.length > maxLength) {
          value = baseValue.substring(0, maxLength - 5) + `_${Math.floor(Math.random() * 100)}`;
        }
      } else {
        value = value.substring(0, maxLength);
      }
    }
    
    if (value.length < 2) {
      value = `${field}_${index + 1}`;
    }
    
    return value;
  }

  protected generateEmailValue(index: number): string {
    const domains = ['company.com', 'example.org', 'test.net', 'demo.io'];
    const names = ['alice', 'bob', 'carol', 'david', 'eve', 'frank', 'grace', 'henry'];
    
    const name = names[index % names.length];
    const domain = domains[index % domains.length];
    const randomSuffix = Math.floor(Math.random() * 10000);
    const timestamp = Date.now();
    
    return `${name}${index}_${randomSuffix}_${timestamp}@${domain}`;
  }

  protected generateUrlValue(field: string, index: number): string {
    if (field.includes('image') || field.includes('avatar')) {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${index}`;
    }
    return `https://example.com/${field}/${index}`;
  }

  protected generateUuidReference(field: string, relationships: Record<string, any[]>): string | undefined {
    for (const [entityType, entities] of Object.entries(relationships)) {
      if (field.includes(entityType.slice(0, -1)) || field.includes(entityType)) {
        if (entities.length > 0) {
          return this.getRandomItem(entities).id;
        }
      }
    }
    return undefined;
  }

  protected generateDateValue(field: string): Date {
    const now = new Date();
    let targetDate: Date;
    
    if (field.includes('due') || field.includes('end')) {
      const daysFromNow = Math.floor(Math.random() * 30) + 1;
      targetDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    } else if (field.includes('start') || field.includes('created')) {
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else if (field.includes('completed')) {
      const daysAgo = Math.floor(Math.random() * 7) + 1;
      targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else {
      targetDate = now;
    }
    
    if (isNaN(targetDate.getTime())) {
      console.warn(`[${this.entityType}Generator] Invalid date generated for field ${field}, using current date`);
      return new Date();
    }
    
    return targetDate;
  }

  protected generateArrayValue(field: string): any[] {
    if (field === 'tags') {
      const allTags = ['frontend', 'backend', 'database', 'api', 'ui', 'ux', 'security', 'performance', 'testing', 'documentation'];
      const numTags = Math.floor(Math.random() * 4);
      if (numTags === 0) {
        return [];
      }
      return this.shuffleArray(allTags).slice(0, numTags);
    }
    return [];
  }

  protected generateEnumValue(field: string): any {
    const enumObj = this.schema.enums[field];
    if (enumObj) {
      const values = Object.values(enumObj);
      return this.getRandomItem(values);
    }
    return null;
  }

  protected generateTsRangeValue(field: string): string | null {
    if (Math.random() < 0.3) {
      return null;
    }
    
    const now = new Date();
    const startTime = new Date(now.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000));
    const endTime = new Date(startTime.getTime() + (1 + Math.floor(Math.random() * 4)) * 60 * 60 * 1000);
    
    const startIso = startTime.toISOString().replace('T', ' ').substring(0, 19);
    const endIso = endTime.toISOString().replace('T', ' ').substring(0, 19);
    
    return `[${startIso}, ${endIso})`;
  }

  protected generateIntervalValue(field: string): string | null {
    if (Math.random() < 0.4) {
      return null;
    }
    
    const intervals = [
      '30 minutes', '1 hour', '2 hours', '3 hours', '4 hours',
      '6 hours', '8 hours', '1 day', '2 days', '3 days', '1 week'
    ];
    
    return this.getRandomItem(intervals);
  }

  protected generateNumberValue(field: string, type: 'number' | 'integer'): number {
    const value = Math.random() * 1000;
    return type === 'integer' ? Math.floor(value) : value;
  }

  // Abstract methods that subclasses must implement
  protected abstract getStringTemplates(field: string): string[];

  // Utility methods
  protected getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  protected shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  protected capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
} 