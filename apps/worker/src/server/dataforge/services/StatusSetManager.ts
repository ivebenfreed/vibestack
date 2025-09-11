/**
 * Status Set Manager
 * 
 * Manages reusable status sets that can be shared across multiple entities.
 * Handles CRUD operations, validation, and organization-level status set management.
 */

import type { Kysely } from 'kysely';
import type { Database } from '../../lib/kysely';

export interface StatusValue {
  value: string;
  label: string;
  color: string;
  backgroundColor: string;
  icon: string;
  workflowCategory: 'not_active' | 'in_progress' | 'done' | 'closed';
}

export interface StatusSet {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  entity_type?: string;
  status_values: StatusValue[];
  is_system_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface EntityStatusSet {
  id: string;
  organization_id: string;
  entity_name: string;
  status_set_id: string;
  field_name: string;
  created_at: Date;
  created_by?: string;
}

export class StatusSetManager {
  constructor(private db: Kysely<Database>) {}

  /**
   * Get all status sets for an organization
   */
  async getStatusSets(orgId: string, entityType?: string): Promise<StatusSet[]> {
    let query = this.db
      .selectFrom('dataforge_status_sets')
      .selectAll()
      .where('organization_id', '=', orgId)
      .where('is_active', '=', true)
      .orderBy('name');

    if (entityType) {
      query = query.where((eb) => 
        eb.or([
          eb('entity_type', '=', entityType),
          eb('entity_type', 'is', null)
        ])
      );
    }

    const results = await query.execute();
    
    return results.map(result => ({
      ...result,
      status_values: Array.isArray(result.status_values) 
        ? result.status_values 
        : JSON.parse(result.status_values as string)
    }));
  }

  /**
   * Get a specific status set by ID
   */
  async getStatusSet(orgId: string, statusSetId: string): Promise<StatusSet | null> {
    try {
      const result = await this.db
        .selectFrom('dataforge_status_sets')
        .selectAll()
        .where('id', '=', statusSetId)
        .where('organization_id', '=', orgId)
        .executeTakeFirst();

      if (!result) return null;

      return {
        ...result,
        status_values: Array.isArray(result.status_values) 
          ? result.status_values 
          : JSON.parse(result.status_values as string)
      };
    } catch (error) {
      console.error(`[StatusSetManager] Error fetching status set ${statusSetId}:`, error);
      return null;
    }
  }

  /**
   * Create a new status set
   */
  async createStatusSet(
    orgId: string, 
    name: string, 
    statusValues: StatusValue[], 
    options: {
      description?: string;
      entityType?: string;
      createdBy?: string;
    } = {}
  ): Promise<StatusSet> {
    // Validate status values
    this.validateStatusValues(statusValues);

    const statusSet = await this.db
      .insertInto('dataforge_status_sets')
      .values({
        organization_id: orgId,
        name,
        description: options.description,
        entity_type: options.entityType,
        status_values: statusValues, // Pass array directly, Kysely will handle JSON conversion
        is_system_default: false,
        is_active: true,
        created_by: options.createdBy
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...statusSet,
      status_values: Array.isArray(statusSet.status_values) 
        ? statusSet.status_values 
        : JSON.parse(statusSet.status_values as string)
    };
  }

  /**
   * Update an existing status set
   */
  async updateStatusSet(
    orgId: string,
    statusSetId: string,
    updates: {
      name?: string;
      description?: string;
      statusValues?: StatusValue[];
    }
  ): Promise<StatusSet> {
    // Check if status set exists and is not system default
    const existing = await this.getStatusSet(orgId, statusSetId);
    if (!existing) {
      throw new Error('Status set not found');
    }
    if (existing.is_system_default) {
      throw new Error('Cannot modify system default status sets');
    }

    // Validate new status values if provided
    if (updates.statusValues) {
      this.validateStatusValues(updates.statusValues);
    }

    const updateData: any = {
      updated_at: new Date()
    };
    
    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.statusValues) updateData.status_values = updates.statusValues; // Pass array directly

    const statusSet = await this.db
      .updateTable('dataforge_status_sets')
      .set(updateData)
      .where('id', '=', statusSetId)
      .where('organization_id', '=', orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...statusSet,
      status_values: Array.isArray(statusSet.status_values) 
        ? statusSet.status_values 
        : JSON.parse(statusSet.status_values as string)
    };
  }

  /**
   * Delete a status set (soft delete)
   */
  async deleteStatusSet(orgId: string, statusSetId: string): Promise<void> {
    // Check if status set exists and is not system default
    const existing = await this.getStatusSet(orgId, statusSetId);
    if (!existing) {
      throw new Error('Status set not found');
    }
    if (existing.is_system_default) {
      throw new Error('Cannot delete system default status sets');
    }

    // Check if status set is in use by any entities
    const usage = await this.db
      .selectFrom('dataforge_entity_status_sets')
      .select(['entity_name'])
      .where('status_set_id', '=', statusSetId)
      .where('organization_id', '=', orgId)
      .execute();

    if (usage.length > 0) {
      const entityNames = usage.map(u => u.entity_name).join(', ');
      throw new Error(`Cannot delete status set. It is currently used by: ${entityNames}`);
    }

    // Soft delete
    await this.db
      .updateTable('dataforge_status_sets')
      .set({ is_active: false, updated_at: new Date() })
      .where('id', '=', statusSetId)
      .where('organization_id', '=', orgId)
      .execute();
  }

  /**
   * Assign a status set to an entity
   */
  async assignStatusSetToEntity(
    orgId: string,
    entityName: string,
    statusSetId: string,
    fieldName: string = 'status',
    createdBy?: string
  ): Promise<EntityStatusSet> {
    // Validate status set exists
    const statusSet = await this.getStatusSet(orgId, statusSetId);
    if (!statusSet) {
      throw new Error('Status set not found');
    }

    // Check for existing status field assignment (prevent multiple status fields)
    const existing = await this.db
      .selectFrom('dataforge_entity_status_sets')
      .selectAll()
      .where('organization_id', '=', orgId)
      .where('entity_name', '=', entityName)
      .where('field_name', '=', fieldName)
      .executeTakeFirst();

    if (existing) {
      throw new Error(`Entity ${entityName} already has a status field named '${fieldName}'`);
    }

    const assignment = await this.db
      .insertInto('dataforge_entity_status_sets')
      .values({
        organization_id: orgId,
        entity_name: entityName,
        status_set_id: statusSetId,
        field_name: fieldName,
        created_by: createdBy
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return assignment;
  }

  /**
   * Get status set assignment for an entity
   */
  async getEntityStatusSet(
    orgId: string,
    entityName: string,
    fieldName: string = 'status'
  ): Promise<(EntityStatusSet & { status_set: StatusSet }) | null> {
    const result = await this.db
      .selectFrom('dataforge_entity_status_sets as ess')
      .innerJoin('dataforge_status_sets as ss', 'ss.id', 'ess.status_set_id')
      .select([
        'ess.id as assignment_id',
        'ess.organization_id',
        'ess.entity_name',
        'ess.status_set_id',
        'ess.field_name',
        'ess.created_at as assignment_created_at',
        'ess.created_by as assignment_created_by',
        'ss.id as status_set_id',
        'ss.name',
        'ss.description',
        'ss.entity_type',
        'ss.status_values',
        'ss.is_system_default',
        'ss.is_active',
        'ss.created_at as status_set_created_at',
        'ss.updated_at',
        'ss.created_by as status_set_created_by'
      ])
      .where('ess.organization_id', '=', orgId)
      .where('ess.entity_name', '=', entityName)
      .where('ess.field_name', '=', fieldName)
      .where('ss.is_active', '=', true)
      .executeTakeFirst();

    if (!result) return null;

    return {
      id: result.assignment_id,
      organization_id: result.organization_id,
      entity_name: result.entity_name,
      status_set_id: result.status_set_id,
      field_name: result.field_name,
      created_at: result.assignment_created_at,
      created_by: result.assignment_created_by,
      status_set: {
        id: result.status_set_id,
        organization_id: result.organization_id,
        name: result.name,
        description: result.description,
        entity_type: result.entity_type,
        status_values: Array.isArray(result.status_values) 
          ? result.status_values 
          : JSON.parse(result.status_values as string),
        is_system_default: result.is_system_default,
        is_active: result.is_active,
        created_at: result.status_set_created_at,
        updated_at: result.updated_at,
        created_by: result.status_set_created_by
      }
    };
  }

  /**
   * Remove status set assignment from entity
   */
  async removeStatusSetFromEntity(
    orgId: string,
    entityName: string,
    fieldName: string = 'status'
  ): Promise<void> {
    await this.db
      .deleteFrom('dataforge_entity_status_sets')
      .where('organization_id', '=', orgId)
      .where('entity_name', '=', entityName)
      .where('field_name', '=', fieldName)
      .execute();
  }

  /**
   * Copy system default status sets to organization
   */
  async copySystemDefaultsToOrg(orgId: string, entityType?: string): Promise<number> {
    const result = await this.db
      .selectFrom('dataforge_status_sets')
      .select(['name', 'description', 'entity_type', 'status_values'])
      .where('organization_id', '=', '*')
      .where('is_system_default', '=', true)
      .where((eb) => entityType ? eb('entity_type', '=', entityType) : eb.val(true))
      .execute();

    let insertedCount = 0;
    for (const systemDefault of result) {
      try {
        await this.db
          .insertInto('dataforge_status_sets')
          .values({
            organization_id: orgId,
            name: systemDefault.name,
            description: systemDefault.description,
            entity_type: systemDefault.entity_type,
            status_values: systemDefault.status_values,
            is_system_default: false,
            is_active: true
          })
          .onConflict((oc) => oc
            .columns(['organization_id', 'name', 'entity_type'])
            .doNothing()
          )
          .execute();
        insertedCount++;
      } catch (error) {
        // Ignore conflicts (status set already exists)
      }
    }

    return insertedCount;
  }

  /**
   * Validate status values array
   */
  private validateStatusValues(statusValues: StatusValue[]): void {
    if (!Array.isArray(statusValues) || statusValues.length === 0) {
      throw new Error('Status values must be a non-empty array');
    }

    const values = new Set<string>();
    for (const status of statusValues) {
      if (!status.value || !status.label) {
        throw new Error('Each status must have value and label');
      }
      if (values.has(status.value)) {
        throw new Error(`Duplicate status value: ${status.value}`);
      }
      values.add(status.value);

      if (!['not_active', 'in_progress', 'done', 'closed'].includes(status.workflowCategory)) {
        throw new Error(`Invalid workflow category: ${status.workflowCategory}`);
      }
    }
  }

  /**
   * Get entities using a specific status set
   */
  async getStatusSetUsage(orgId: string, statusSetId: string): Promise<EntityStatusSet[]> {
    return await this.db
      .selectFrom('dataforge_entity_status_sets')
      .selectAll()
      .where('organization_id', '=', orgId)
      .where('status_set_id', '=', statusSetId)
      .execute();
  }

  /**
   * Get default status set for entity type
   */
  async getDefaultStatusSetForEntityType(
    orgId: string,
    entityType: string
  ): Promise<StatusSet | null> {
    // First try to find org-specific default
    let result = await this.db
      .selectFrom('dataforge_status_sets')
      .selectAll()
      .where('organization_id', '=', orgId)
      .where('entity_type', '=', entityType)
      .where('is_active', '=', true)
      .orderBy('created_at', 'asc')
      .executeTakeFirst();

    // If no org-specific default, copy system default
    if (!result) {
      await this.copySystemDefaultsToOrg(orgId, entityType);
      result = await this.db
        .selectFrom('dataforge_status_sets')
        .selectAll()
        .where('organization_id', '=', orgId)
        .where('entity_type', '=', entityType)
        .where('is_active', '=', true)
        .executeTakeFirst();
    }

    if (!result) return null;

    return {
      ...result,
      status_values: Array.isArray(result.status_values) 
        ? result.status_values 
        : JSON.parse(result.status_values as string)
    };
  }
}