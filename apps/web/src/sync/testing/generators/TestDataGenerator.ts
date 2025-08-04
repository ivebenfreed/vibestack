import { v4 as uuidv4 } from 'uuid';
import { TaskStatus, TaskPriority, ProjectStatus, UserRole } from '@repo/dataforge/client-entities';
import type { EntityType } from '../core/TestTypes';

// Domain entity types only (no system entities)
type DomainEntityType = 'users' | 'projects' | 'tasks' | 'comments';

// Universal services interface for domain entities
interface DomainServices {
  users: {
    createUser(userData: any): Promise<any>;
    updateUser(id: string, changes: any): Promise<any>;
    deleteUser(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    getAll?(): Promise<any[]>;
  };
  projects: {
    createProject(projectData: any): Promise<any>;
    updateProject(id: string, changes: any): Promise<any>;
    deleteProject(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    updateProjectMembers?(projectId: string, userIds: string[]): Promise<any[]>;
    addProjectMember?(projectId: string, userId: string): Promise<any[]>;
    removeProjectMember?(projectId: string, userId: string): Promise<any[]>;
    getAll?(): Promise<any[]>;
  };
  tasks: {
    createTask(taskData: any): Promise<any>;
    updateTask(id: string, changes: any): Promise<any>;
    deleteTask(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    updateTaskStatus?(id: string, status: TaskStatus): Promise<any>;
    getByProject?(projectId: string): Promise<any[]>;
    getByAssignee?(assigneeId: string): Promise<any[]>;
    getAll?(): Promise<any[]>;
  };
  comments: {
    createComment(commentData: any): Promise<any>;
    updateComment(id: string, changes: any): Promise<any>;
    deleteComment(id: string): Promise<boolean>;
    get(id: string): Promise<any>;
    getByTask?(taskId: string): Promise<any[]>;
    getByProject?(projectId: string): Promise<any[]>;
    getAll?(): Promise<any[]>;
  };
}

// Coverage validation interfaces
interface CoverageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    entities: EntityCoverage[];
    services: ServiceCoverage[];
    relationships: RelationshipCoverage[];
    joinTables: JoinTableCoverage[];
  };
}

interface EntityCoverage {
  entity: string;
  hasSchema: boolean;
  hasService: boolean;
  requiredFields: FieldCoverage[];
  optionalFields: FieldCoverage[];
  enums: EnumCoverage[];
  missingFields?: string[];
}

interface FieldCoverage {
  field: string;
  type: string;
  isValid: boolean;
  issues?: string[];
}

interface EnumCoverage {
  field: string;
  enumName: string;
  isImported: boolean;
  hasAllValues: boolean;
  missingValues?: string[];
}

interface ServiceCoverage {
  entity: string;
  hasService: boolean;
  methods: MethodCoverage[];
  missingMethods?: string[];
}

interface MethodCoverage {
  method: string;
  exists: boolean;
  isRequired: boolean;
}

interface RelationshipCoverage {
  entity: string;
  relationship: string;
  type: 'belongsTo' | 'hasMany' | 'manyToMany';
  targetEntity: string;
  isValid: boolean;
  issues?: string[];
}

interface JoinTableCoverage {
  table: string;
  entities: [string, string];
  hasServiceSupport: boolean;
  methods: string[];
  missingMethods?: string[];
}

// Entity schema definitions for domain entities
interface EntitySchema {
  requiredFields: Record<string, any>;
  optionalFields: Record<string, any>;
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

// Define schemas for domain entities only
const DOMAIN_ENTITY_SCHEMAS: Record<DomainEntityType, EntitySchema> = {
  users: {
    requiredFields: {
      name: 'string',
      email: 'email',
      emailVerified: 'boolean',
      role: 'enum'
    },
    optionalFields: {
      image: 'url'
    },
    relationships: {
      hasMany: [
        { field: 'tasks', entity: 'tasks' },
        { field: 'ownedProjects', entity: 'projects' }
      ],
      manyToMany: [
        { field: 'memberProjects', entity: 'projects', joinTable: 'project_members' }
      ]
    },
    enums: {
      role: UserRole
    },
    constraints: {
      unique: ['email'],
      maxLength: { name: 100, email: 255 },
      patterns: {
        name: /^[a-zA-Z0-9\s\-']+$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      }
    }
  },
  projects: {
    requiredFields: {
      name: 'string',
      status: 'enum'
    },
    optionalFields: {
      description: 'string',
      ownerId: 'uuid'
    },
    relationships: {
      belongsTo: [
        { field: 'owner', entity: 'users', required: false }
      ],
      hasMany: [
        { field: 'tasks', entity: 'tasks' },
        { field: 'comments', entity: 'comments' }
      ],
      manyToMany: [
        { field: 'members', entity: 'users', joinTable: 'project_members' }
      ]
    },
    enums: {
      status: ProjectStatus
    },
    constraints: {
      maxLength: { name: 100, description: 5000 },
      patterns: {
        name: /^[a-zA-Z0-9\s\-_'.]+$/
      }
    }
  },
  tasks: {
    requiredFields: {
      title: 'string',
      status: 'enum',
      priority: 'enum',
      tags: 'array'
    },
    optionalFields: {
      description: 'string',
      projectId: 'uuid',
      assigneeId: 'uuid',
      dueDate: 'date',
      startDate: 'date',
      completedAt: 'date',
      timeRange: 'tsrange',
      estimatedDuration: 'interval'
    },
    relationships: {
      belongsTo: [
        { field: 'project', entity: 'projects', required: false },
        { field: 'assignee', entity: 'users', required: false }
      ],
      hasMany: [
        { field: 'comments', entity: 'comments' }
      ],
      manyToMany: [
        { field: 'dependencies', entity: 'tasks', joinTable: 'task_dependencies' }
      ]
    },
    enums: {
      status: TaskStatus,
      priority: TaskPriority
    },
    constraints: {
      maxLength: { title: 100, description: 5000 }
    }
  },
  comments: {
    requiredFields: {
      content: 'string'
    },
    optionalFields: {
      authorId: 'uuid',
      parentId: 'uuid',
      taskId: 'uuid',
      projectId: 'uuid'
    },
    relationships: {
      belongsTo: [
        { field: 'author', entity: 'users', required: false },
        { field: 'task', entity: 'tasks', required: false },
        { field: 'project', entity: 'projects', required: false },
        { field: 'parent', entity: 'comments', required: false }
      ]
    },
    enums: {},
    constraints: {
      maxLength: { content: 5000 }
    }
  }
};

// Expected join tables and their service requirements
const EXPECTED_JOIN_TABLES: Record<string, {
  entities: [string, string];
  requiredMethods: string[];
  optionalMethods: string[];
}> = {
  project_members: {
    entities: ['users', 'projects'] as [string, string],
    requiredMethods: ['updateProjectMembers'],
    optionalMethods: ['addProjectMember', 'removeProjectMember']
  },
  task_dependencies: {
    entities: ['tasks', 'tasks'] as [string, string],
    requiredMethods: [],
    optionalMethods: ['updateTaskDependencies', 'addTaskDependency', 'removeTaskDependency']
  }
};

/**
 * Universal Test Data Generator for Domain Entities
 * Handles users, projects, tasks, comments and their join table relationships
 */
export class TestDataGenerator {
  private createdEntities: Record<DomainEntityType, any[]> = {
    users: [], 
    projects: [], 
    tasks: [], 
    comments: []
  };

  constructor(private services: DomainServices) {
    if (!services) {
      throw new Error('Services are required for TestDataGenerator');
    }
  }

  /**
   * STEP 1: Validate complete coverage of domain entities, services, and relationships
   * This must pass before any tests can run
   */
  async validateDomainCoverage(): Promise<CoverageValidationResult> {
    const result: CoverageValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      coverage: {
        entities: [],
        services: [],
        relationships: [],
        joinTables: []
      }
    };

    // Validate entity schemas
    const entityCoverage = this.validateEntitySchemas();
    result.coverage.entities = entityCoverage;

    // Validate service coverage
    const serviceCoverage = this.validateServiceCoverage();
    result.coverage.services = serviceCoverage;

    // Validate relationship coverage
    const relationshipCoverage = this.validateRelationshipCoverage();
    result.coverage.relationships = relationshipCoverage;

    // Validate join table coverage
    const joinTableCoverage = this.validateJoinTableCoverage();
    result.coverage.joinTables = joinTableCoverage;

    // Collect all errors and warnings
    this.collectValidationIssues(result);

    // Set overall validity
    result.isValid = result.errors.length === 0;

    return result;
  }

  /**
   * STEP 2: Run domain test suite only if coverage validation passes
   */
  async runDomainTestSuiteWithValidation(options: {
    entities?: DomainEntityType[];
    counts?: Partial<Record<DomainEntityType, number>>;
    includeJoinTables?: boolean;
    includeEdgeCases?: boolean;
    skipValidation?: boolean;
  } = {}): Promise<{
    coverageValidation: CoverageValidationResult;
    dataset?: Record<DomainEntityType, any[]>;
    joinTables?: Record<string, any[]>;
    edgeCases?: any;
    statistics?: any;
  }> {
    // Always run validation first unless explicitly skipped
    const coverageValidation = options.skipValidation ? 
      { isValid: true, errors: [], warnings: [], coverage: { entities: [], services: [], relationships: [], joinTables: [] } } :
      await this.validateDomainCoverage();

    if (!coverageValidation.isValid) {
      return {
        coverageValidation,
        // No test data if validation fails
      };
    }

    // Run the actual test suite
    const testResults = await this.runDomainTestSuite(options);

    return {
      coverageValidation,
      ...testResults
    };
  }

  // Validation methods
  private validateEntitySchemas(): EntityCoverage[] {
    const coverage: EntityCoverage[] = [];
    const expectedEntities: DomainEntityType[] = ['users', 'projects', 'tasks', 'comments'];

    for (const entity of expectedEntities) {
      const schema = DOMAIN_ENTITY_SCHEMAS[entity];
      const entityCoverage: EntityCoverage = {
        entity,
        hasSchema: !!schema,
        hasService: !!this.services[entity],
        requiredFields: [],
        optionalFields: [],
        enums: []
      };

      if (schema) {
        // Validate required fields
        for (const [field, type] of Object.entries(schema.requiredFields)) {
          entityCoverage.requiredFields.push({
            field,
            type,
            isValid: this.validateFieldType(type)
          });
        }

        // Validate optional fields
        for (const [field, type] of Object.entries(schema.optionalFields)) {
          entityCoverage.optionalFields.push({
            field,
            type,
            isValid: this.validateFieldType(type)
          });
        }

        // Validate enums
        for (const [field, enumObj] of Object.entries(schema.enums)) {
          entityCoverage.enums.push({
            field,
            enumName: enumObj.name || 'Unknown',
            isImported: this.validateEnumImport(enumObj),
            hasAllValues: this.validateEnumValues(enumObj)
          });
        }
      }

      coverage.push(entityCoverage);
    }

    return coverage;
  }

  private validateServiceCoverage(): ServiceCoverage[] {
    const coverage: ServiceCoverage[] = [];
    const expectedEntities: DomainEntityType[] = ['users', 'projects', 'tasks', 'comments'];
    
    // Define actual method names that exist in the services
    const requiredMethodMappings: Record<string, string[]> = {
      users: ['createUser', 'updateUser', 'deleteUser', 'get'],
      projects: ['createProject', 'updateProject', 'deleteProject', 'get'],
      tasks: ['createTask', 'updateTask', 'deleteTask', 'get'],
      comments: ['createComment', 'updateComment', 'deleteComment', 'get']
    };
    
    const optionalMethods = ['getAll', 'getByProject', 'getByAssignee', 'getByTask'];

    for (const entity of expectedEntities) {
      const service = this.services[entity];
      const serviceCoverage: ServiceCoverage = {
        entity,
        hasService: !!service,
        methods: [],
        missingMethods: []
      };

      if (service) {
        // Check required methods using the correct names
        const requiredMethods = requiredMethodMappings[entity];
        for (const methodName of requiredMethods) {
          const exists = typeof (service as any)[methodName] === 'function';
          serviceCoverage.methods.push({
            method: methodName,
            exists,
            isRequired: true
          });
          if (!exists) {
            serviceCoverage.missingMethods = serviceCoverage.missingMethods || [];
            serviceCoverage.missingMethods.push(methodName);
          }
        }

        // Check optional methods
        for (const method of optionalMethods) {
          const exists = typeof (service as any)[method] === 'function';
          if (exists) {
            serviceCoverage.methods.push({
              method,
              exists: true,
              isRequired: false
            });
          }
        }
        
        // Special check for join table methods on projects service
        if (entity === 'projects') {
          const joinTableMethods = ['updateProjectMembers', 'addProjectMember', 'removeProjectMember'];
          for (const method of joinTableMethods) {
            const exists = typeof (service as any)[method] === 'function';
            if (exists) {
              serviceCoverage.methods.push({
                method,
                exists: true,
                isRequired: false
              });
            }
          }
        }
      } else {
        serviceCoverage.missingMethods = requiredMethodMappings[entity];
      }

      coverage.push(serviceCoverage);
    }

    return coverage;
  }

  private validateRelationshipCoverage(): RelationshipCoverage[] {
    const coverage: RelationshipCoverage[] = [];

    for (const [entityName, schema] of Object.entries(DOMAIN_ENTITY_SCHEMAS)) {
      // Validate belongsTo relationships
      if (schema.relationships.belongsTo) {
        for (const relation of schema.relationships.belongsTo) {
          coverage.push({
            entity: entityName,
            relationship: relation.field,
            type: 'belongsTo',
            targetEntity: relation.entity,
            isValid: this.validateRelationship(entityName as DomainEntityType, relation.entity, 'belongsTo')
          });
        }
      }

      // Validate hasMany relationships
      if (schema.relationships.hasMany) {
        for (const relation of schema.relationships.hasMany) {
          coverage.push({
            entity: entityName,
            relationship: relation.field,
            type: 'hasMany',
            targetEntity: relation.entity,
            isValid: this.validateRelationship(entityName as DomainEntityType, relation.entity, 'hasMany')
          });
        }
      }

      // Validate manyToMany relationships
      if (schema.relationships.manyToMany) {
        for (const relation of schema.relationships.manyToMany) {
          coverage.push({
            entity: entityName,
            relationship: relation.field,
            type: 'manyToMany',
            targetEntity: relation.entity,
            isValid: this.validateRelationship(entityName as DomainEntityType, relation.entity, 'manyToMany', relation.joinTable)
          });
        }
      }
    }

    return coverage;
  }

  private validateJoinTableCoverage(): JoinTableCoverage[] {
    const coverage: JoinTableCoverage[] = [];

    for (const [tableName, tableConfig] of Object.entries(EXPECTED_JOIN_TABLES)) {
      const [entity1, entity2] = tableConfig.entities;
      const joinTableCoverage: JoinTableCoverage = {
        table: tableName,
        entities: [entity1, entity2],
        hasServiceSupport: false,
        methods: [],
        missingMethods: []
      };

      // For project_members, methods are on the projects service
      // For task_dependencies, methods would be on the tasks service
      let serviceToCheck: any = null;
      if (tableName === 'project_members') {
        serviceToCheck = this.services.projects;
      } else if (tableName === 'task_dependencies') {
        serviceToCheck = this.services.tasks;
      } else {
        // Default to first entity service
        serviceToCheck = this.services[entity1 as DomainEntityType];
      }

      if (serviceToCheck) {
        for (const method of tableConfig.requiredMethods) {
          const exists = typeof (serviceToCheck as any)[method] === 'function';
          if (exists) {
            joinTableCoverage.methods.push(method);
          } else {
            if (!joinTableCoverage.missingMethods) {
              joinTableCoverage.missingMethods = [];
            }
            joinTableCoverage.missingMethods.push(method);
          }
        }

        for (const method of tableConfig.optionalMethods) {
          const exists = typeof (serviceToCheck as any)[method] === 'function';
          if (exists) {
            joinTableCoverage.methods.push(method);
          }
        }

        joinTableCoverage.hasServiceSupport = tableConfig.requiredMethods.length > 0 ? 
          tableConfig.requiredMethods.every(method => 
            typeof (serviceToCheck as any)[method] === 'function'
          ) : 
          joinTableCoverage.methods.length > 0; // If no required methods, check if any optional methods exist
      } else {
        joinTableCoverage.missingMethods = [...tableConfig.requiredMethods];
      }

      coverage.push(joinTableCoverage);
    }

    return coverage;
  }

  private collectValidationIssues(result: CoverageValidationResult): void {
    // Entity issues
    for (const entity of result.coverage.entities) {
      if (!entity.hasSchema) {
        result.errors.push(`Missing schema definition for entity: ${entity.entity}`);
      }
      if (!entity.hasService) {
        result.errors.push(`Missing service for entity: ${entity.entity}`);
      }
      
      // Field issues
      for (const field of [...entity.requiredFields, ...entity.optionalFields]) {
        if (!field.isValid) {
          result.warnings.push(`Invalid field type '${field.type}' for ${entity.entity}.${field.field}`);
        }
      }

      // Enum issues
      for (const enumField of entity.enums) {
        if (!enumField.isImported) {
          result.errors.push(`Enum ${enumField.enumName} for ${entity.entity}.${enumField.field} is not properly imported`);
        }
        if (!enumField.hasAllValues) {
          result.warnings.push(`Enum ${enumField.enumName} may be missing some values`);
        }
      }
    }

    // Service issues
    for (const service of result.coverage.services) {
      if (!service.hasService) {
        result.errors.push(`Missing service implementation for: ${service.entity}`);
      }
      if (service.missingMethods && service.missingMethods.length > 0) {
        result.errors.push(`Missing required methods for ${service.entity}: ${service.missingMethods.join(', ')}`);
      }
    }

    // Relationship issues
    for (const relationship of result.coverage.relationships) {
      if (!relationship.isValid) {
        result.errors.push(`Invalid relationship ${relationship.entity}.${relationship.relationship} -> ${relationship.targetEntity}`);
      }
    }

    // Join table issues
    for (const joinTable of result.coverage.joinTables) {
      if (!joinTable.hasServiceSupport) {
        result.warnings.push(`Join table ${joinTable.table} lacks service support. Missing methods: ${joinTable.missingMethods?.join(', ') || 'unknown'}`);
      }
    }
  }

  // Helper validation methods
  private validateFieldType(type: string): boolean {
    const validTypes = ['string', 'email', 'url', 'uuid', 'date', 'boolean', 'array', 'enum', 'number', 'integer'];
    return validTypes.includes(type);
  }

  private validateEnumImport(enumObj: any): boolean {
    // Check if enum object has actual enum values
    return enumObj && typeof enumObj === 'object' && Object.keys(enumObj).length > 0;
  }

  private validateEnumValues(enumObj: any): boolean {
    // Basic validation that enum has values
    return enumObj && Object.values(enumObj).length > 0;
  }

  private validateRelationship(fromEntity: DomainEntityType, toEntity: string, type: string, joinTable?: string): boolean {
    // Check if target entity exists in our schemas
    const targetExists = DOMAIN_ENTITY_SCHEMAS[toEntity as DomainEntityType] !== undefined;
    
    // For manyToMany, also check if joinTable is defined
    if (type === 'manyToMany' && joinTable) {
      return targetExists && EXPECTED_JOIN_TABLES[joinTable] !== undefined;
    }
    
    return targetExists;
  }

  /**
   * Generate a detailed coverage report
   */
  generateCoverageReport(validation: CoverageValidationResult): string {
    const report = [];
    
    report.push('='.repeat(80));
    report.push('DOMAIN ENTITY COVERAGE VALIDATION REPORT');
    report.push('='.repeat(80));
    report.push('');
    
    report.push(`Overall Status: ${validation.isValid ? '✅ PASS' : '❌ FAIL'}`);
    report.push(`Errors: ${validation.errors.length}`);
    report.push(`Warnings: ${validation.warnings.length}`);
    report.push('');

    if (validation.errors.length > 0) {
      report.push('ERRORS:');
      validation.errors.forEach(error => report.push(`  ❌ ${error}`));
      report.push('');
    }

    if (validation.warnings.length > 0) {
      report.push('WARNINGS:');
      validation.warnings.forEach(warning => report.push(`  ⚠️  ${warning}`));
      report.push('');
    }

    // Entity coverage details
    report.push('ENTITY COVERAGE:');
    validation.coverage.entities.forEach(entity => {
      const status = entity.hasSchema && entity.hasService ? '✅' : '❌';
      report.push(`  ${status} ${entity.entity.toUpperCase()}`);
      report.push(`    Schema: ${entity.hasSchema ? '✅' : '❌'}`);
      report.push(`    Service: ${entity.hasService ? '✅' : '❌'}`);
      report.push(`    Required Fields: ${entity.requiredFields.length}`);
      report.push(`    Optional Fields: ${entity.optionalFields.length}`);
      report.push(`    Enums: ${entity.enums.length}`);
    });
    report.push('');

    // Join table coverage
    report.push('JOIN TABLE COVERAGE:');
    validation.coverage.joinTables.forEach(joinTable => {
      const status = joinTable.hasServiceSupport ? '✅' : '⚠️';
      report.push(`  ${status} ${joinTable.table}`);
      report.push(`    Entities: ${joinTable.entities.join(' ↔ ')}`);
      report.push(`    Methods: ${joinTable.methods.join(', ') || 'none'}`);
      if (joinTable.missingMethods && joinTable.missingMethods.length > 0) {
        report.push(`    Missing: ${joinTable.missingMethods.join(', ')}`);
      }
    });

    report.push('');
    report.push('='.repeat(80));
    
    return report.join('\n');
  }

  /**
   * Create test data for any domain entity type universally
   */
  async createTestData(
    entityType: DomainEntityType, 
    count: number = 1, 
    options: {
      variation?: 'minimal' | 'basic' | 'complete';
      relationships?: Record<string, any[]>;
      overrides?: Record<string, any>;
    } = {}
  ): Promise<any[]> {
    const { variation = 'complete', relationships = {}, overrides = {} } = options;
    const schema = DOMAIN_ENTITY_SCHEMAS[entityType];
    
    if (!schema) {
      throw new Error(`No schema defined for entity type: ${entityType}`);
    }

    const service = this.services[entityType];
    if (!service) {
      throw new Error(`No service available for entity type: ${entityType}`);
    }

    const entities = [];
    
    for (let i = 0; i < count; i++) {
      try {
        // Generate base data according to schema
        const entityData = await this.generateEntityData(entityType, schema, variation, relationships, overrides, i);
        
        // Debug logging for troubleshooting the timestamp issue
        console.log(`[TestDataGenerator] Creating ${entityType} #${i + 1} with data:`, {
          entityType,
          index: i,
          dataKeys: Object.keys(entityData),
          dateFields: Object.entries(entityData).filter(([key, value]) => 
            value instanceof Date || (typeof value === 'string' && (key.includes('date') || key.includes('Date') || key.includes('At')))
          ),
          stringFields: Object.entries(entityData).filter(([key, value]) => 
            typeof value === 'string' && value.length < 20
          ),
          entityData: JSON.stringify(entityData, (key, value) => 
            value instanceof Date ? `Date(${value.toISOString()})` : value
          )
        });
        
        // Create entity using appropriate service method
        let createdEntity;
        switch (entityType) {
          case 'users':
            createdEntity = await this.services.users.createUser(entityData);
            break;
          case 'projects':
            createdEntity = await this.services.projects.createProject(entityData);
            break;
          case 'tasks':
            createdEntity = await this.services.tasks.createTask(entityData);
            break;
          case 'comments':
            createdEntity = await this.services.comments.createComment(entityData);
            break;
          default:
            throw new Error(`Unsupported entity type: ${entityType}`);
        }
        
        console.log(`[TestDataGenerator] Successfully created ${entityType} #${i + 1} with id: ${createdEntity.id}`);
        
        entities.push(createdEntity);
        this.createdEntities[entityType].push(createdEntity);
      } catch (error) {
        console.error(`[TestDataGenerator] Error creating ${entityType} #${i + 1}:`, error);
        console.error(`[TestDataGenerator] Failed entity data was:`, {
          entityType,
          index: i,
          error: (error as Error).message,
          stack: (error as Error).stack
        });
        throw error; // Re-throw to stop the process and get more details
      }
    }

    return entities;
  }

  /**
   * Generate entity data according to schema
   */
  private async generateEntityData(
    entityType: DomainEntityType,
    schema: EntitySchema,
    variation: string,
    relationships: Record<string, any[]>,
    overrides: Record<string, any>,
    index: number
  ): Promise<any> {
    const data: any = { ...overrides };

    // Handle required fields
    for (const [field, type] of Object.entries(schema.requiredFields)) {
      if (data[field] === undefined) {
        data[field] = await this.generateFieldValue(field, type, schema, entityType, index, relationships);
      }
    }

    // Handle optional fields based on variation
    if (variation !== 'minimal') {
      for (const [field, type] of Object.entries(schema.optionalFields)) {
        if (data[field] === undefined && (variation === 'complete' || Math.random() > 0.3)) {
          data[field] = await this.generateFieldValue(field, type, schema, entityType, index, relationships);
        }
      }
    }

    // Handle relationships
    await this.handleRelationships(data, schema, relationships, entityType);

    return data;
  }

  /**
   * Generate field value based on type and constraints
   */
  private async generateFieldValue(
    field: string,
    type: string,
    schema: EntitySchema,
    entityType: DomainEntityType,
    index: number,
    relationships: Record<string, any[]>
  ): Promise<any> {
    const constraints = schema.constraints;
    
    // Debug logging for critical field generation
    if (field.includes('date') || field.includes('Date') || field.includes('At')) {
      console.log(`[TestDataGenerator] Generating ${type} for field "${field}" (entity: ${entityType})`);
    }
    
    switch (type) {
      case 'string':
        const stringValue = this.generateStringValue(field, entityType, index, constraints);
        // Extra safety check for date-like field names
        if (field.includes('date') || field.includes('Date') || field.includes('At')) {
          console.error(`[TestDataGenerator] CRITICAL: String generated for date-like field "${field}": "${stringValue}"`);
          console.error(`[TestDataGenerator] Field type was "${type}" but field name suggests it should be a date field`);
          throw new Error(`Invalid field type mapping: field "${field}" has type "${type}" but appears to be a date field`);
        }
        return stringValue;
      case 'email':
        return this.generateEmailValue(index, constraints);
      case 'url':
        return this.generateUrlValue(field, index);
      case 'uuid':
        return this.generateUuidReference(field, relationships);
      case 'date':
        const dateValue = this.generateDateValue(field);
        console.log(`[TestDataGenerator] Generated date for "${field}": ${dateValue?.toISOString()}`);
        return dateValue;
      case 'boolean':
        return Math.random() > 0.5;
      case 'array':
        return this.generateArrayValue(field, entityType);
      case 'enum':
        const enumValue = this.generateEnumValue(field, schema.enums);
        console.log(`[TestDataGenerator] Generated enum for "${field}": ${enumValue}`);
        return enumValue;
      case 'tsrange':
        return this.generateTsRangeValue(field);
      case 'interval':
        return this.generateIntervalValue(field);
      default:
        console.warn(`[TestDataGenerator] Unknown field type "${type}" for field "${field}", returning null`);
        return null;
    }
  }

  /**
   * Handle entity relationships and set default values
   */
  private async handleRelationships(
    data: any,
    schema: EntitySchema,
    relationships: Record<string, any[]>,
    entityType: DomainEntityType
  ): Promise<void> {
    // Note: Required enum values are now handled by the field generation process
    // since they're properly defined as required fields in the schema
    
    // Handle belongsTo relationships
    if (schema.relationships.belongsTo) {
      for (const relation of schema.relationships.belongsTo) {
        const relationField = relation.field + 'Id';
        
        if (data[relationField] === undefined) {
          // Try to use provided relationships
          if (relationships[relation.entity] && relationships[relation.entity].length > 0) {
            const relatedEntity = this.getRandomItem(relationships[relation.entity]);
            data[relationField] = relatedEntity.id;
          } else if (relation.required) {
            // Create required relationship if not provided
            const relatedEntities = await this.createTestData(relation.entity, 1);
            data[relationField] = relatedEntities[0].id;
          }
        }
      }
    }
  }

  /**
   * Handle many-to-many relationships using join tables
   */
  async handleJoinTableRelationships(
    dataset: Record<DomainEntityType, any[]>
  ): Promise<Record<string, any[]>> {
    const joinTableOperations: Record<string, any[]> = {};

    // Handle project_members join table (users <-> projects)
    if (dataset.projects?.length && dataset.users?.length && this.services.projects?.updateProjectMembers) {
      const membershipOperations = [];
      
      for (const project of dataset.projects) {
        const memberCount = Math.floor(Math.random() * 4) + 2; // 2-5 members
        const members = this.shuffleArray([...dataset.users]).slice(0, memberCount);
        const memberIds = members.map(u => u.id);
        
        const result = await this.services.projects.updateProjectMembers(project.id, memberIds);
        membershipOperations.push({
          projectId: project.id,
          memberIds,
          result
        });
      }
      
      joinTableOperations.project_members = membershipOperations;
    }

    // Handle task_dependencies join table (tasks <-> tasks) if service supports it
    if (dataset.tasks?.length) {
      const dependencyOperations = [];
      
      for (const task of dataset.tasks.slice(0, Math.floor(dataset.tasks.length / 2))) {
        const potentialDependencies = dataset.tasks.filter(t => t.id !== task.id);
        if (potentialDependencies.length > 0) {
          const dependencyCount = Math.floor(Math.random() * 3) + 1; // 1-3 dependencies
          const dependencies = this.shuffleArray(potentialDependencies).slice(0, dependencyCount);
          
          dependencyOperations.push({
            taskId: task.id,
            dependencies: dependencies.map(d => d.id),
            note: 'Task dependencies - would require specific service method'
          });
        }
      }
      
      if (dependencyOperations.length > 0) {
        joinTableOperations.task_dependencies = dependencyOperations;
      }
    }

    return joinTableOperations;
  }

  /**
   * Run comprehensive test suite for domain entities
   */
  async runDomainTestSuite(options: {
    entities?: DomainEntityType[];
    counts?: Partial<Record<DomainEntityType, number>>;
    includeJoinTables?: boolean;
    includeEdgeCases?: boolean;
  } = {}): Promise<{
    dataset: Record<DomainEntityType, any[]>;
    joinTables: Record<string, any[]>;
    edgeCases?: any;
    statistics: any;
  }> {
    const {
      entities = ['users', 'projects', 'tasks', 'comments'],
      counts = { users: 8, projects: 4, tasks: 15, comments: 25 },
      includeJoinTables = true,
      includeEdgeCases = false
    } = options;

    const dataset: Record<DomainEntityType, any[]> = {} as any;
    
    // Create entities in dependency order
    const dependencyOrder = this.resolveDependencyOrder(entities);
    
    for (const entityType of dependencyOrder) {
      const count = counts[entityType] || 5;
      const relationships: Record<string, any[]> = {};
      
      // Provide existing entities as relationship options
      for (const [key, value] of Object.entries(dataset)) {
        if (value.length > 0) {
          relationships[key] = value;
        }
      }
      
      dataset[entityType] = await this.createTestData(entityType, count, { relationships });
    }

    // Handle join table relationships
    let joinTableResults = {};
    if (includeJoinTables) {
      joinTableResults = await this.handleJoinTableRelationships(dataset);
    }

    // Handle edge cases
    let edgeCases;
    if (includeEdgeCases) {
      edgeCases = await this.createDomainEdgeCases(entities);
    }

    // Generate statistics
    const statistics = this.generateStatistics(dataset, joinTableResults);

    return {
      dataset,
      joinTables: joinTableResults,
      edgeCases,
      statistics
    };
  }

  /**
   * Test complex CRUD scenarios with join table relationships
   */
  async createComplexCRUDScenarios(dataset: Record<DomainEntityType, any[]>): Promise<{
    membershipChanges: any[];
    taskReassignments: any[];
    projectTransfers: any[];
    cascadeDeletes: any[];
  }> {
    const membershipChanges = [];
    const taskReassignments = [];
    const projectTransfers = [];
    const cascadeDeletes = [];

    // Test project membership changes (join table operations)
    for (const project of dataset.projects.slice(0, 2)) {
      // Add new members
      const newMembers = this.shuffleArray(dataset.users).slice(0, 2);
      const memberIds = newMembers.map(u => u.id);
      
      if (this.services.projects.updateProjectMembers) {
        const updatedMembers = await this.services.projects.updateProjectMembers(project.id, memberIds);
        membershipChanges.push({
          type: 'add_members',
          projectId: project.id,
          addedMembers: memberIds,
          result: updatedMembers
        });

        // Remove some members later
        const remainingMembers = memberIds.slice(1);
        const reducedMembers = await this.services.projects.updateProjectMembers(project.id, remainingMembers);
        membershipChanges.push({
          type: 'remove_members',
          projectId: project.id,
          remainingMembers,
          result: reducedMembers
        });
      }
    }

    // Test task reassignments (foreign key updates)
    for (const task of dataset.tasks.slice(0, 3)) {
      const newAssignee = this.shuffleArray(dataset.users)[0];
      const updatedTask = await this.services.tasks.updateTask(task.id, {
        assigneeId: newAssignee.id
      });
      taskReassignments.push({
        taskId: task.id,
        oldAssigneeId: task.assigneeId,
        newAssigneeId: newAssignee.id,
        result: updatedTask
      });
    }

    // Test project ownership transfers
    for (const project of dataset.projects.slice(0, 2)) {
      const newOwner = this.shuffleArray(dataset.users)[0];
      const updatedProject = await this.services.projects.updateProject(project.id, {
        ownerId: newOwner.id
      });
      projectTransfers.push({
        projectId: project.id,
        oldOwnerId: project.ownerId,
        newOwnerId: newOwner.id,
        result: updatedProject
      });
    }

    // Test cascade deletes
    const projectToDelete = dataset.projects[dataset.projects.length - 1];
    const relatedTasks = dataset.tasks.filter(t => t.projectId === projectToDelete.id);
    const relatedComments = dataset.comments.filter(c => 
      relatedTasks.some(t => t.id === c.taskId) || c.projectId === projectToDelete.id
    );

    cascadeDeletes.push({
      deletedProject: projectToDelete.id,
      expectedAffectedTasks: relatedTasks.map(t => t.id),
      expectedAffectedComments: relatedComments.map(c => c.id)
    });

    await this.services.projects.deleteProject(projectToDelete.id);

    return { membershipChanges, taskReassignments, projectTransfers, cascadeDeletes };
  }

  // Helper methods
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private generateStringValue(field: string, entityType: DomainEntityType, index: number, constraints?: any): string {
    const templates = this.getStringTemplates(field, entityType);
    const template = templates[index % templates.length];
    const maxLength = constraints?.maxLength?.[field] || 255;
    
    // Check if this field has a unique constraint
    const schema = DOMAIN_ENTITY_SCHEMAS[entityType];
    const isUnique = schema?.constraints?.unique?.includes(field);
    
    // Process template replacements first
    const baseValue = template
      .replace('{{index}}', String(index + 1))
      .replace('{{timestamp}}', String(Date.now()));
    
    // Add random suffix for unique fields
    const randomSuffix = isUnique ? `_${Math.floor(Math.random() * 10000)}_${Date.now()}` : '';
    
    let value = baseValue + randomSuffix;
    
    // Ensure we don't truncate to an invalid state
    if (value.length > maxLength) {
      if (isUnique) {
        // For unique fields, ensure we keep some uniqueness while respecting length
        const minUniqueLength = 10; // Minimum chars for uniqueness
        const availableLength = Math.max(maxLength - minUniqueLength, 5);
        const shortRandomSuffix = `_${Math.floor(Math.random() * 1000)}`;
        
        value = baseValue.substring(0, availableLength) + shortRandomSuffix;
        
        // Final check - ensure we don't exceed max length
        if (value.length > maxLength) {
          value = baseValue.substring(0, maxLength - 5) + `_${Math.floor(Math.random() * 100)}`;
        }
      } else {
        // For non-unique fields, simple truncation is fine
        value = value.substring(0, maxLength);
      }
    }
    
    // Critical safeguard: ensure minimum length and no invalid characters
    if (value.length < 2) {
      console.warn(`[TestDataGenerator] Generated string too short: "${value}" for field ${field}, using fallback`);
      value = `${field}_${index + 1}`;
    }
    
    // Additional safety check for timestamp-related issues
    if (value.length === 1) {
      console.error(`[TestDataGenerator] Critical: Single character string generated: "${value}" for field ${field}`);
      value = `safe_${field}_${index}`;
    }
    
    // Debug logging for problematic values
    if (value.length < 3 || value === 'I' || value.includes('I') && value.length < 5) {
      console.log(`[TestDataGenerator] Potential issue with generated string:`, {
        field,
        entityType,
        index,
        template,
        baseValue,
        randomSuffix,
        finalValue: value,
        maxLength,
        isUnique
      });
    }
    
    return value;
  }

  private generateEmailValue(index: number, constraints?: any): string {
    const domains = ['company.com', 'example.org', 'test.net', 'demo.io'];
    const names = ['alice', 'bob', 'carol', 'david', 'eve', 'frank', 'grace', 'henry'];
    
    const name = names[index % names.length];
    const domain = domains[index % domains.length];
    const randomSuffix = Math.floor(Math.random() * 10000);
    const timestamp = Date.now();
    
    return `${name}${index}_${randomSuffix}_${timestamp}@${domain}`;
  }

  private generateUrlValue(field: string, index: number): string {
    if (field.includes('image') || field.includes('avatar')) {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${index}`;
    }
    return `https://example.com/${field}/${index}`;
  }

  private generateUuidReference(field: string, relationships: Record<string, any[]>): string | undefined {
    // Try to find related entities
    for (const [entityType, entities] of Object.entries(relationships)) {
      if (field.includes(entityType.slice(0, -1)) || field.includes(entityType)) {
        if (entities.length > 0) {
          return this.getRandomItem(entities).id;
        }
      }
    }
    return undefined;
  }

  private generateDateValue(field: string): Date {
    const now = new Date();
    let targetDate: Date;
    
    if (field.includes('due') || field.includes('end')) {
      // Future date (1-30 days from now)
      const daysFromNow = Math.floor(Math.random() * 30) + 1;
      targetDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
    } else if (field.includes('start') || field.includes('created')) {
      // Past date (1-30 days ago)
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else if (field.includes('completed')) {
      // Past date for completed items (1-7 days ago)
      const daysAgo = Math.floor(Math.random() * 7) + 1;
      targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    } else {
      // Default to current time
      targetDate = now;
    }
    
    // Ensure the date is valid
    if (isNaN(targetDate.getTime())) {
      console.warn(`[TestDataGenerator] Invalid date generated for field ${field}, using current date`);
      return new Date();
    }
    
    return targetDate;
  }

  private generateArrayValue(field: string, entityType: DomainEntityType): any[] {
    if (field === 'tags') {
      const allTags = ['frontend', 'backend', 'database', 'api', 'ui', 'ux', 'security', 'performance', 'testing', 'documentation'];
      const numTags = Math.floor(Math.random() * 4); // 0-3 tags
      if (numTags === 0) {
        return []; // Return empty array sometimes to test this case
      }
      return this.shuffleArray(allTags).slice(0, numTags);
    }
    
    // Default: return empty array for any array field
    return [];
  }

  private generateEnumValue(field: string, enums: Record<string, any>): any {
    const enumObj = enums[field];
    if (enumObj) {
      const values = Object.values(enumObj);
      return this.getRandomItem(values);
    }
    return null;
  }

  private getStringTemplates(field: string, entityType: DomainEntityType): string[] {
    const templates: Record<string, string[]> = {
      name: ['User {{index}}', 'Person {{index}}', 'Test User {{index}}'],
      title: ['Task {{index}}', 'Fix Bug {{index}}', 'Feature {{index}}', 'Update {{index}}'],
      description: ['Task description {{index}}', 'Details for item {{index}}', 'Info about {{index}}'],
      content: ['Comment {{index}}', 'Note {{index}}', 'Feedback {{index}}'],
    };
    
    return templates[field] || [`Item {{index}}`];
  }

  private resolveDependencyOrder(entities: DomainEntityType[]): DomainEntityType[] {
    // Define dependency order (entities with no dependencies first)
    const dependencyOrder: DomainEntityType[] = [
      'users',      // No dependencies
      'projects',   // Depends on users (owner)
      'tasks',      // Depends on projects and users
      'comments'    // Depends on tasks, projects, and users
    ];
    
    return dependencyOrder.filter(entity => entities.includes(entity));
  }

  private async createDomainEdgeCases(entities: DomainEntityType[]): Promise<any> {
    const edgeCases: any = {};
    
    for (const entityType of entities) {
      const schema = DOMAIN_ENTITY_SCHEMAS[entityType];
      edgeCases[entityType] = {
        minimal: await this.createTestData(entityType, 1, { variation: 'minimal' }),
        maxLength: await this.testMaxLengthConstraints(entityType, schema),
        specialCharacters: await this.testSpecialCharacters(entityType, schema),
        enumValues: await this.testAllEnumValues(entityType, schema)
      };
    }
    
    return edgeCases;
  }

  private async testMaxLengthConstraints(entityType: DomainEntityType, schema: EntitySchema): Promise<any> {
    const overrides: any = {};
    
    for (const [field, maxLength] of Object.entries(schema.constraints.maxLength || {})) {
      overrides[field] = 'A'.repeat(maxLength - 1); // Just under the limit
    }
    
    try {
      return await this.createTestData(entityType, 1, { overrides });
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  private async testSpecialCharacters(entityType: DomainEntityType, schema: EntitySchema): Promise<any> {
    const overrides: any = {};
    
    for (const field of Object.keys(schema.requiredFields)) {
      if (schema.requiredFields[field] === 'string') {
        overrides[field] = 'Test ñáéíóú 中文 🚀 Special Characters';
      }
    }
    
    try {
      return await this.createTestData(entityType, 1, { overrides });
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  private async testAllEnumValues(entityType: DomainEntityType, schema: EntitySchema): Promise<any> {
    const enumTests: any = {};
    
    for (const [field, enumObj] of Object.entries(schema.enums)) {
      const enumValues = Object.values(enumObj);
      enumTests[field] = [];
      
      for (const value of enumValues) {
        try {
          const result = await this.createTestData(entityType, 1, { 
            overrides: { [field]: value }
          });
          enumTests[field].push({ value, result: result[0] });
        } catch (error) {
          enumTests[field].push({ value, error: (error as Error).message });
        }
      }
    }
    
    return enumTests;
  }

  private generateStatistics(dataset: Record<DomainEntityType, any[]>, joinTables: Record<string, any[]>): any {
    const stats: any = {
      entities: {},
      joinTables: {},
      total: 0
    };
    
    for (const [entityType, entities] of Object.entries(dataset)) {
      stats.entities[entityType] = entities.length;
      stats.total += entities.length;
    }
    
    for (const [joinTableType, operations] of Object.entries(joinTables)) {
      stats.joinTables[joinTableType] = operations.length;
    }
    
    return stats;
  }

  // Legacy compatibility methods (DEPRECATED - use createRaw* methods for sync isolation)
  async createTestUsers(count: number = 5): Promise<any[]> {
    return this.createTestData('users', count);
  }

  async createTestProjects(count: number = 3, owners?: any[]): Promise<any[]> {
    const relationships: Record<string, any[]> = owners ? { users: owners } : {};
    return this.createTestData('projects', count, { relationships });
  }

  async createTestTasks(count: number = 10, projects?: any[], assignees?: any[]): Promise<any[]> {
    const relationships: Record<string, any[]> = {};
    if (projects) relationships.projects = projects;
    if (assignees) relationships.users = assignees;
    return this.createTestData('tasks', count, { relationships });
  }

  async createTestComments(count: number = 15, tasks?: any[], authors?: any[]): Promise<any[]> {
    const relationships: Record<string, any[]> = {};
    if (tasks) relationships.tasks = tasks;
    if (authors) relationships.users = authors;
    return this.createTestData('comments', count, { relationships });
  }

  async createRealisticDataset(options: any = {}): Promise<any> {
    const result = await this.runDomainTestSuite({
      counts: options,
      includeJoinTables: true
    });
    return result.dataset;
  }

  private generateTsRangeValue(field: string): string | null {
    // Generate a PostgreSQL tsrange (timestamp range) like '[2024-01-01 10:00:00, 2024-01-01 12:00:00)'
    // Return null for some cases to test optional behavior
    if (Math.random() < 0.3) {
      return null;
    }
    
    const now = new Date();
    const startTime = new Date(now.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000)); // Random time in next 24 hours
    const endTime = new Date(startTime.getTime() + (1 + Math.floor(Math.random() * 4)) * 60 * 60 * 1000); // 1-4 hours later
    
    // Format as PostgreSQL tsrange: '[start_timestamp, end_timestamp)'
    const startIso = startTime.toISOString().replace('T', ' ').substring(0, 19);
    const endIso = endTime.toISOString().replace('T', ' ').substring(0, 19);
    
    return `[${startIso}, ${endIso})`;
  }

  private generateIntervalValue(field: string): string | null {
    // Generate a PostgreSQL interval like '2 hours', '1 day', '30 minutes'
    // Return null for some cases to test optional behavior
    if (Math.random() < 0.4) {
      return null;
    }
    
    const intervals = [
      '30 minutes',
      '1 hour',
      '2 hours', 
      '3 hours',
      '4 hours',
      '6 hours',
      '8 hours',
      '1 day',
      '2 days',
      '3 days',
      '1 week'
    ];
    
    return this.getRandomItem(intervals);
  }

  // NEW: Raw data generation methods (for sync isolation)
  async createRawUsers(count: number = 5): Promise<any[]> {
    return this.createRawTestData('users', count);
  }

  async createRawProjects(count: number = 3, owners?: any[]): Promise<any[]> {
    const relationships: Record<string, any[]> = owners ? { users: owners } : {};
    return this.createRawTestData('projects', count, { relationships });
  }

  async createRawTasks(count: number = 10, projects?: any[], assignees?: any[]): Promise<any[]> {
    const relationships: Record<string, any[]> = {};
    if (projects) relationships.projects = projects;
    if (assignees) relationships.users = assignees;
    return this.createRawTestData('tasks', count, { relationships });
  }

  async createRawComments(count: number = 15, tasks?: any[], authors?: any[]): Promise<any[]> {
    const relationships: Record<string, any[]> = {};
    if (tasks) relationships.tasks = tasks;
    if (authors) relationships.users = authors;
    return this.createRawTestData('comments', count, { relationships });
  }

  /**
   * Create raw test data objects without calling any services
   * This method generates pure data objects that can be used with fromSync methods
   */
  async createRawTestData(
    entityType: DomainEntityType, 
    count: number = 1, 
    options: {
      variation?: 'minimal' | 'basic' | 'complete';
      relationships?: Record<string, any[]>;
      overrides?: Record<string, any>;
    } = {}
  ): Promise<any[]> {
    const { variation = 'complete', relationships = {}, overrides = {} } = options;
    const schema = DOMAIN_ENTITY_SCHEMAS[entityType];
    
    if (!schema) {
      throw new Error(`No schema defined for entity type: ${entityType}`);
    }

    const entities = [];
    
    for (let i = 0; i < count; i++) {
      try {
        // Generate base data according to schema
        const entityData = await this.generateEntityDataForRaw(entityType, schema, variation, relationships, overrides, i);
        
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
        
        console.log(`[TestDataGenerator] Generated raw ${entityType} #${i + 1} with id: ${entityData.id}`);
        
        entities.push(entityData);
      } catch (error) {
        console.error(`[TestDataGenerator] Error generating raw ${entityType} #${i + 1}:`, error);
        throw error;
      }
    }

    return entities;
  }

  /**
   * Generate entity data for raw objects (no service calls)
   */
  private async generateEntityDataForRaw(
    entityType: DomainEntityType,
    schema: EntitySchema,
    variation: string,
    relationships: Record<string, any[]>,
    overrides: Record<string, any>,
    index: number
  ): Promise<any> {
    const data: any = { ...overrides };

    // Handle required fields
    for (const [field, type] of Object.entries(schema.requiredFields)) {
      if (data[field] === undefined) {
        data[field] = await this.generateFieldValue(field, type, schema, entityType, index, relationships);
      }
    }

    // Handle optional fields based on variation
    if (variation !== 'minimal') {
      for (const [field, type] of Object.entries(schema.optionalFields)) {
        if (data[field] === undefined && (variation === 'complete' || Math.random() > 0.3)) {
          data[field] = await this.generateFieldValue(field, type, schema, entityType, index, relationships);
        }
      }
    }

    // Handle relationships without calling services
    await this.handleRelationshipsForRawData(data, schema, relationships, entityType);

    return data;
  }

  /**
   * Handle relationships for raw data generation (no service calls)
   */
  private async handleRelationshipsForRawData(
    data: any,
    schema: EntitySchema,
    relationships: Record<string, any[]>,
    entityType: DomainEntityType
  ): Promise<void> {
    // Handle belongsTo relationships
    if (schema.relationships.belongsTo) {
      for (const relation of schema.relationships.belongsTo) {
        const relationField = relation.field + 'Id';
        
        if (data[relationField] === undefined) {
          // Try to use provided relationships
          if (relationships[relation.entity] && relationships[relation.entity].length > 0) {
            const relatedEntity = this.getRandomItem(relationships[relation.entity]);
            data[relationField] = relatedEntity.id;
          } else if (relation.required) {
            // For raw data, we'll leave required relationships as null
            // The calling code should provide the relationships or handle this
            console.warn(`[TestDataGenerator] Required relationship ${relation.entity} not provided for ${entityType}, setting ${relationField} to null`);
            data[relationField] = null;
          }
        }
      }
    }
  }
} 