import type { 
  ValidationResult, 
  TestExecutionContext,
  RelationshipOperation
} from '../core/TestTypes';
import type { TableChange, RelationshipUpdate } from '@repo/sync-types';
import { SyncTestFramework } from '../core/SyncTestFramework';

/**
 * Validator for relationship changes and junction table operations
 * Validates many-to-many relationships, consistency, and sync encoding
 */
export class RelationshipValidator {
  constructor(private framework: SyncTestFramework) {}

  /**
   * Validate relationship changes in pending changes queue
   */
  async validateRelationshipChanges(
    testContext: TestExecutionContext,
    expectedOperations: Array<{
      entityId: string;
      relationName: string;
      operation: RelationshipOperation;
      targetIds: string[];
    }>
  ): Promise<ValidationResult> {
    try {
      const pendingChanges = await this.framework.getLocalChanges();
      
      // Find relationship changes
      const relationshipChanges = pendingChanges.filter(change => 
        change.relationshipUpdates && change.relationshipUpdates.length > 0
      );

      if (expectedOperations.length === 0) {
        return {
          status: relationshipChanges.length === 0 ? 'passed' : 'warning',
          message: relationshipChanges.length === 0 ? 
            'No relationship changes found as expected' : 
            'Unexpected relationship changes found',
          details: { relationshipChanges: relationshipChanges.length }
        };
      }

      // Validate each expected operation
      const validationResults = [];
      for (const expected of expectedOperations) {
        const result = this.validateSingleRelationshipOperation(
          relationshipChanges,
          expected
        );
        validationResults.push(result);
      }

      const failedValidations = validationResults.filter(r => r.status === 'failed');
      
      if (failedValidations.length > 0) {
        return {
          status: 'failed',
          message: `${failedValidations.length} relationship validations failed`,
          details: {
            failed: failedValidations,
            total: validationResults.length
          }
        };
      }

      return {
        status: 'passed',
        message: `All ${validationResults.length} relationship operations validated successfully`,
        details: { validationResults }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Error validating relationship changes',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate relationship consistency across entities
   */
  async validateRelationshipConsistency(
    testContext: TestExecutionContext,
    relationships: Array<{
      sourceEntity: string;
      sourceId: string;
      targetEntity: string;
      relationName: string;
      expectedTargetIds: string[];
    }>
  ): Promise<ValidationResult> {
    try {
      const services = this.framework.getServices();
      if (!services) {
        throw new Error('Services not available for consistency validation');
      }

      const consistencyChecks = [];

      for (const rel of relationships) {
        try {
          let actualTargetIds: string[] = [];

          // Get actual relationship data based on entity type
          switch (rel.sourceEntity) {
            case 'projects':
              if (rel.relationName === 'members') {
                const members = await services.projects.getProjectMembers(rel.sourceId);
                actualTargetIds = members.map((m: any) => m.id);
              }
              break;
            case 'tasks':
              if (rel.relationName === 'dependencies') {
                // Note: Task dependencies need to be implemented
                actualTargetIds = []; // Placeholder
              }
              break;
          }

          const isConsistent = this.arraysEqual(
            actualTargetIds.sort(),
            rel.expectedTargetIds.sort()
          );

          consistencyChecks.push({
            sourceEntity: rel.sourceEntity,
            sourceId: rel.sourceId,
            relationName: rel.relationName,
            expectedTargetIds: rel.expectedTargetIds,
            actualTargetIds,
            isConsistent,
            missingIds: rel.expectedTargetIds.filter(id => !actualTargetIds.includes(id)),
            extraIds: actualTargetIds.filter(id => !rel.expectedTargetIds.includes(id))
          });

        } catch (error) {
          consistencyChecks.push({
            sourceEntity: rel.sourceEntity,
            sourceId: rel.sourceId,
            relationName: rel.relationName,
            expectedTargetIds: rel.expectedTargetIds,
            actualTargetIds: [],
            isConsistent: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const inconsistentChecks = consistencyChecks.filter(check => !check.isConsistent);

      if (inconsistentChecks.length > 0) {
        return {
          status: 'failed',
          message: `${inconsistentChecks.length} relationship consistency checks failed`,
          details: {
            inconsistentChecks,
            allChecks: consistencyChecks
          },
          suggestions: [
            'Check relationship operation implementations',
            'Verify sync encoding for relationship changes',
            'Ensure proper junction table updates'
          ]
        };
      }

      return {
        status: 'passed',
        message: `All ${consistencyChecks.length} relationship consistency checks passed`,
        details: { consistencyChecks }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Error validating relationship consistency',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate relationship encoding in sync changes
   */
  async validateRelationshipEncoding(
    testContext: TestExecutionContext,
    entityTable: string,
    entityId: string,
    expectedRelationshipUpdates: RelationshipUpdate[]
  ): Promise<ValidationResult> {
    try {
      const pendingChanges = await this.framework.getLocalChanges();
      
      // Find changes for the specific entity
      const entityChanges = pendingChanges.filter(change => 
        change.table === entityTable && 
        change.data?.id === entityId &&
        change.relationshipUpdates
      );

      if (entityChanges.length === 0) {
        return {
          status: 'failed',
          message: `No relationship changes found for ${entityTable}:${entityId}`,
          details: { entityTable, entityId, totalChanges: pendingChanges.length }
        };
      }

      // Validate relationship updates encoding
      const encodingValidation = [];
      
      for (const change of entityChanges) {
        const relUpdates = change.relationshipUpdates || [];
        
        for (const expected of expectedRelationshipUpdates) {
          const matching = relUpdates.find((ru: RelationshipUpdate) => 
            ru.relationName === expected.relationName &&
            ru.operation === expected.operation
          );

          if (!matching) {
            encodingValidation.push({
              relationName: expected.relationName,
              operation: expected.operation,
              found: false,
              error: 'Relationship update not found in change'
            });
            continue;
          }

          // Validate target IDs
          const targetIdsMatch = this.arraysEqual(
            matching.targetIds.sort(),
            expected.targetIds.sort()
          );

          encodingValidation.push({
            relationName: expected.relationName,
            operation: expected.operation,
            found: true,
            targetIdsMatch,
            expectedTargetIds: expected.targetIds,
            actualTargetIds: matching.targetIds,
            valid: targetIdsMatch
          });
        }
      }

      const invalidEncodings = encodingValidation.filter(v => !v.valid);

      if (invalidEncodings.length > 0) {
        return {
          status: 'failed',
          message: `${invalidEncodings.length} relationship encoding validations failed`,
          details: {
            invalidEncodings,
            allValidations: encodingValidation,
            entityChanges
          },
          suggestions: [
            'Check RelationshipChangeEncoder implementation',
            'Verify relationship update structure',
            'Ensure correct target ID collection'
          ]
        };
      }

      return {
        status: 'passed',
        message: `All relationship encodings validated successfully`,
        details: { encodingValidation }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Error validating relationship encoding',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate junction table operations
   */
  async validateJunctionTableOperations(
    testContext: TestExecutionContext,
    operations: Array<{
      junctionTable: string;
      sourceColumn: string;
      targetColumn: string;
      sourceId: string;
      expectedTargetIds: string[];
      operation: 'set' | 'add' | 'remove';
    }>
  ): Promise<ValidationResult> {
    try {
      // Note: This would require direct database access to validate junction tables
      // For now, we'll validate through the relationship API
      
      const validationResults = [];
      
      for (const op of operations) {
        // Map junction table to entity relationship
        let entityService = null;
        let relationName = '';
        
        switch (op.junctionTable) {
          case 'project_members':
            entityService = this.framework.getServices()?.projects;
            relationName = 'members';
            break;
          case 'task_dependencies':
            // Note: Task dependencies not implemented yet
            validationResults.push({
              junctionTable: op.junctionTable,
              operation: op.operation,
              valid: false,
              note: 'Task dependencies not implemented in TaskService'
            });
            continue;
        }

        if (!entityService) {
          validationResults.push({
            junctionTable: op.junctionTable,
            operation: op.operation,
            valid: false,
            error: 'Entity service not available'
          });
          continue;
        }

        try {
          // Validate through relationship API
          const members = await entityService.getProjectMembers(op.sourceId);
          const actualTargetIds = members.map((m: any) => m.id);
          
          let isValid = false;
          switch (op.operation) {
            case 'set':
              isValid = this.arraysEqual(
                actualTargetIds.sort(),
                op.expectedTargetIds.sort()
              );
              break;
            case 'add':
              isValid = op.expectedTargetIds.every(id => actualTargetIds.includes(id));
              break;
            case 'remove':
              isValid = !op.expectedTargetIds.some(id => actualTargetIds.includes(id));
              break;
          }

          validationResults.push({
            junctionTable: op.junctionTable,
            operation: op.operation,
            sourceId: op.sourceId,
            expectedTargetIds: op.expectedTargetIds,
            actualTargetIds,
            valid: isValid
          });

        } catch (error) {
          validationResults.push({
            junctionTable: op.junctionTable,
            operation: op.operation,
            valid: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const invalidOperations = validationResults.filter(v => !v.valid);

      if (invalidOperations.length > 0) {
        return {
          status: 'failed',
          message: `${invalidOperations.length} junction table validations failed`,
          details: {
            invalidOperations,
            allValidations: validationResults
          },
          suggestions: [
            'Check junction table update queries',
            'Verify foreign key constraints',
            'Ensure proper transaction handling'
          ]
        };
      }

      return {
        status: 'passed',
        message: `All junction table operations validated successfully`,
        details: { validationResults }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Error validating junction table operations',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate relationship symmetry (for bidirectional relationships)
   */
  async validateRelationshipSymmetry(
    testContext: TestExecutionContext,
    relationships: Array<{
      entityAType: string;
      entityAId: string;
      entityBType: string;
      entityBId: string;
      relationName: string;
      inverseRelationName: string;
    }>
  ): Promise<ValidationResult> {
    try {
      const services = this.framework.getServices();
      if (!services) {
        throw new Error('Services not available for symmetry validation');
      }

      const symmetryChecks = [];

      for (const rel of relationships) {
        try {
          // Check A -> B relationship
          const aToB = await this.getRelationshipTargets(
            services, 
            rel.entityAType, 
            rel.entityAId, 
            rel.relationName
          );
          
          // Check B -> A relationship (inverse)
          const bToA = await this.getRelationshipTargets(
            services, 
            rel.entityBType, 
            rel.entityBId, 
            rel.inverseRelationName
          );

          const aToBContainsB = aToB.includes(rel.entityBId);
          const bToAContainsA = bToA.includes(rel.entityAId);
          const isSymmetric = aToBContainsB === bToAContainsA;

          symmetryChecks.push({
            entityAType: rel.entityAType,
            entityAId: rel.entityAId,
            entityBType: rel.entityBType,
            entityBId: rel.entityBId,
            relationName: rel.relationName,
            inverseRelationName: rel.inverseRelationName,
            aToBContainsB,
            bToAContainsA,
            isSymmetric
          });

        } catch (error) {
          symmetryChecks.push({
            entityAType: rel.entityAType,
            entityAId: rel.entityAId,
            entityBType: rel.entityBType,
            entityBId: rel.entityBId,
            relationName: rel.relationName,
            inverseRelationName: rel.inverseRelationName,
            isSymmetric: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const asymmetricChecks = symmetryChecks.filter(check => !check.isSymmetric);

      if (asymmetricChecks.length > 0) {
        return {
          status: 'failed',
          message: `${asymmetricChecks.length} relationship symmetry checks failed`,
          details: {
            asymmetricChecks,
            allChecks: symmetryChecks
          },
          suggestions: [
            'Check bidirectional relationship implementations',
            'Verify inverse relationship updates',
            'Ensure proper cascading relationship changes'
          ]
        };
      }

      return {
        status: 'passed',
        message: `All ${symmetryChecks.length} relationship symmetry checks passed`,
        details: { symmetryChecks }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Error validating relationship symmetry',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate relationship integrity constraints
   */
  async validateRelationshipIntegrity(
    testContext: TestExecutionContext,
    constraints: Array<{
      type: 'foreign_key' | 'cascade' | 'restrict';
      description: string;
      check: () => Promise<boolean>;
    }>
  ): Promise<ValidationResult> {
    try {
      const integrityResults = [];

      for (const constraint of constraints) {
        try {
          const passed = await constraint.check();
          integrityResults.push({
            type: constraint.type,
            description: constraint.description,
            passed,
            error: null
          });
        } catch (error) {
          integrityResults.push({
            type: constraint.type,
            description: constraint.description,
            passed: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const failedConstraints = integrityResults.filter(r => !r.passed);

      if (failedConstraints.length > 0) {
        return {
          status: 'failed',
          message: `${failedConstraints.length} integrity constraints failed`,
          details: {
            failedConstraints,
            allResults: integrityResults
          },
          suggestions: [
            'Check foreign key constraint definitions',
            'Verify cascade delete implementations',
            'Ensure proper constraint validation'
          ]
        };
      }

      return {
        status: 'passed',
        message: `All ${integrityResults.length} integrity constraints passed`,
        details: { integrityResults }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Error validating relationship integrity',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Private helper methods
   */

  private validateSingleRelationshipOperation(
    relationshipChanges: TableChange[],
    expected: {
      entityId: string;
      relationName: string;
      operation: RelationshipOperation;
      targetIds: string[];
    }
  ): ValidationResult {
    // Find changes for the entity
    const entityChanges = relationshipChanges.filter(change => 
      change.data?.id === expected.entityId
    );

    if (entityChanges.length === 0) {
      return {
        status: 'failed',
        message: `No relationship changes found for entity ${expected.entityId}`,
        details: expected
      };
    }

    // Find matching relationship update
    for (const change of entityChanges) {
      const relUpdates = change.relationshipUpdates || [];
      const matching = relUpdates.find(ru =>
        ru.relationName === expected.relationName &&
        ru.operation === expected.operation
      );

      if (matching) {
        const targetIdsMatch = this.arraysEqual(
          matching.targetIds.sort(),
          expected.targetIds.sort()
        );

        if (targetIdsMatch) {
          return {
            status: 'passed',
            message: `Relationship operation validated successfully`,
            details: { expected, actual: matching }
          };
        } else {
          return {
            status: 'failed',
            message: `Target IDs mismatch for relationship operation`,
            details: {
              expected: expected.targetIds,
              actual: matching.targetIds,
              relationName: expected.relationName,
              operation: expected.operation
            }
          };
        }
      }
    }

    return {
      status: 'failed',
      message: `Relationship operation not found`,
      details: {
        expected,
        availableOperations: entityChanges.flatMap(c => 
          (c.relationshipUpdates || []).map(ru => ({
            relationName: ru.relationName,
            operation: ru.operation
          }))
        )
      }
    };
  }

  private async getRelationshipTargets(
    services: any,
    entityType: string,
    entityId: string,
    relationName: string
  ): Promise<string[]> {
    switch (entityType) {
      case 'projects':
        if (relationName === 'members') {
          const members = await services.projects.getProjectMembers(entityId);
          return members.map((m: any) => m.id);
        }
        break;
      case 'tasks':
        if (relationName === 'dependencies') {
          // Note: Task dependencies not implemented
          return [];
        }
        break;
    }
    
    return [];
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }
} 