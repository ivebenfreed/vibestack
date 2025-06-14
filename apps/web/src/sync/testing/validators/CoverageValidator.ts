import { TaskStatus, TaskPriority, ProjectStatus, UserRole } from '@repo/dataforge/client-entities';
import type { DomainEntityType } from '../datagen/BaseDataGenerator';

// Coverage validation interfaces
export interface CoverageValidationResult {
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

export interface EntityCoverage {
  entity: string;
  hasSchema: boolean;
  hasService: boolean;
  requiredFields: FieldCoverage[];
  optionalFields: FieldCoverage[];
  enums: EnumCoverage[];
  missingFields?: string[];
}

export interface FieldCoverage {
  field: string;
  type: string;
  isValid: boolean;
  issues?: string[];
}

export interface EnumCoverage {
  field: string;
  enumName: string;
  isImported: boolean;
  hasAllValues: boolean;
  missingValues?: string[];
}

export interface ServiceCoverage {
  entity: string;
  hasService: boolean;
  methods: MethodCoverage[];
  missingMethods?: string[];
}

export interface MethodCoverage {
  method: string;
  exists: boolean;
  isRequired: boolean;
}

export interface RelationshipCoverage {
  entity: string;
  relationship: string;
  type: 'belongsTo' | 'hasMany' | 'manyToMany';
  targetEntity: string;
  isValid: boolean;
  issues?: string[];
}

export interface JoinTableCoverage {
  table: string;
  entities: [string, string];
  hasServiceSupport: boolean;
  methods: string[];
  missingMethods?: string[];
}

// Entity schema definition for validation
interface EntitySchema {
  requiredFields: Record<string, string>;
  optionalFields: Record<string, string>;
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

// Define schemas for domain entities
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
 * Validator for domain entity coverage
 * Validates that all entities, services, relationships, and join tables are properly configured
 */
export class CoverageValidator {
  constructor(private services: any) {}

  /**
   * Validate complete coverage of domain entities, services, and relationships
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

  // Private validation methods
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
    
    const requiredMethodMappings: Record<string, string[]> = {
      users: ['createUser', 'createFromSync', 'updateUser', 'updateFromSync', 'deleteUser', 'deleteFromSync', 'get'],
      projects: ['createProject', 'createFromSync', 'updateProject', 'updateFromSync', 'deleteProject', 'deleteFromSync', 'get'],
      tasks: ['createTask', 'createFromSync', 'updateTask', 'updateFromSync', 'deleteTask', 'deleteFromSync', 'get'],
      comments: ['createComment', 'createFromSync', 'updateComment', 'updateFromSync', 'deleteComment', 'deleteFromSync', 'get']
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

      let serviceToCheck: any = null;
      if (tableName === 'project_members') {
        serviceToCheck = this.services.projects;
      } else if (tableName === 'task_dependencies') {
        serviceToCheck = this.services.tasks;
      } else {
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
          joinTableCoverage.methods.length > 0;
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
      
      for (const field of [...entity.requiredFields, ...entity.optionalFields]) {
        if (!field.isValid) {
          result.warnings.push(`Invalid field type '${field.type}' for ${entity.entity}.${field.field}`);
        }
      }

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
    const validTypes = ['string', 'email', 'url', 'uuid', 'date', 'boolean', 'array', 'enum', 'number', 'integer', 'tsrange', 'interval'];
    return validTypes.includes(type);
  }

  private validateEnumImport(enumObj: any): boolean {
    return enumObj && typeof enumObj === 'object' && Object.keys(enumObj).length > 0;
  }

  private validateEnumValues(enumObj: any): boolean {
    return enumObj && Object.values(enumObj).length > 0;
  }

  private validateRelationship(fromEntity: DomainEntityType, toEntity: string, type: string, joinTable?: string): boolean {
    const targetExists = DOMAIN_ENTITY_SCHEMAS[toEntity as DomainEntityType] !== undefined;
    
    if (type === 'manyToMany' && joinTable) {
      return targetExists && EXPECTED_JOIN_TABLES[joinTable] !== undefined;
    }
    
    return targetExists;
  }
} 