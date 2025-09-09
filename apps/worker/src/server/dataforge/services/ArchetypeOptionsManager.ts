/**
 * Archetype Options Manager
 * 
 * Manages copying system option templates to custom options for organizations.
 * System options serve as templates only - all live UI data comes from custom options.
 */

import type { Kysely } from 'kysely';

export interface SystemOptionTemplate {
  id: string;
  option_set_type: string;  // 'priority', 'status', 'category'
  archetype: string;        // 'task', 'project', etc.
  name: string;
  description?: string;
}

export interface SystemOptionValue {
  id: string;
  option_set_id: string;
  value: string;           // Semantic value for app logic
  label: string;           // Default display label
  description?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
}

export class ArchetypeOptionsManager {
  
  /**
   * Ensure organization has custom options for all archetype option types
   */
  static async ensureArchetypeOptions(
    kysely: Kysely<any>, 
    orgId: string, 
    archetype: string
  ): Promise<void> {
    console.log(`[ArchetypeOptions] Ensuring ${archetype} options for org ${orgId}`);
    
    // Get all system option templates for this archetype
    const systemSets = await kysely
      .selectFrom('system_option_sets')
      .where('archetype', '=', archetype)
      .selectAll()
      .execute();
      
    console.log(`[ArchetypeOptions] Found ${systemSets.length} system option sets for ${archetype}`);
    
    for (const systemSet of systemSets) {
      await this.ensureCustomOptionSet(kysely, orgId, systemSet);
    }
  }

  /**
   * Copy a specific system option set to custom options for an organization
   */
  private static async ensureCustomOptionSet(
    kysely: Kysely<any>,
    orgId: string, 
    systemSet: SystemOptionTemplate
  ): Promise<void> {
    console.log(`[ArchetypeOptions] Ensuring custom option set ${systemSet.option_set_type} for org ${orgId}`);
    
    // Check if custom option set already exists
    const existingSet = await kysely
      .selectFrom('custom_option_sets')
      .select('id')
      .where('org_id', '=', orgId)
      .where('option_set_type', '=', systemSet.option_set_type)
      .execute();
      
    if (existingSet.length > 0) {
      console.log(`[ArchetypeOptions] Custom option set ${systemSet.option_set_type} already exists for org ${orgId}`);
      return; // Already exists
    }

    // Create custom option set
    const customSet = await kysely
      .insertInto('custom_option_sets')
      .values({
        org_id: orgId,
        option_set_type: systemSet.option_set_type,
        name: systemSet.name,
        description: systemSet.description ? `${systemSet.description} (Customizable)` : null,
        is_active: true,
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('id')
      .execute();

    const customSetId = customSet[0].id;
    console.log(`[ArchetypeOptions] Created custom option set ${customSetId} for ${systemSet.option_set_type}`);

    // Copy system options to custom options
    await this.copySystemOptionsToCustom(kysely, systemSet.id, customSetId);
  }

  /**
   * Copy all options from a system set to a custom set
   */
  private static async copySystemOptionsToCustom(
    kysely: Kysely<any>,
    systemSetId: string,
    customSetId: string
  ): Promise<void> {
    // Get all system options for this set
    const systemOptions = await kysely
      .selectFrom('system_options')
      .where('option_set_id', '=', systemSetId)
      .where('is_active', '=', true)
      .selectAll()
      .execute();
      
    console.log(`[ArchetypeOptions] Copying ${systemOptions.length} system options to custom set ${customSetId}`);

    // Copy each option
    for (const sysOpt of systemOptions) {
      await kysely
        .insertInto('custom_options')
        .values({
          option_set_id: customSetId,
          value: sysOpt.value,              // Preserve semantic value for app logic
          label: sysOpt.label,              // Copy default label (editable)
          description: sysOpt.description,  // Copy description (editable)
          color: sysOpt.color,              // Copy default color (editable)
          icon: sysOpt.icon,                // Copy default icon (editable)
          sort_order: sysOpt.sort_order,    // Copy sort order (editable)
          is_active: sysOpt.is_active,      // Copy active state (editable)
          metadata: sysOpt.metadata || {},  // Copy metadata (editable)
          created_at: new Date(),
          updated_at: new Date()
        })
        .execute();
    }
    
    console.log(`[ArchetypeOptions] Successfully copied system options to custom set ${customSetId}`);
  }

  /**
   * Get all available archetypes
   */
  static async getAvailableArchetypes(kysely: Kysely<any>): Promise<string[]> {
    const archetypes = await kysely
      .selectFrom('system_option_sets')
      .select('archetype')
      .distinct()
      .execute();
      
    return archetypes.map(row => row.archetype);
  }

  /**
   * Get all option types for an archetype
   */
  static async getArchetypeOptionTypes(kysely: Kysely<any>, archetype: string): Promise<string[]> {
    const optionTypes = await kysely
      .selectFrom('system_option_sets')
      .select('option_set_type')
      .where('archetype', '=', archetype)
      .distinct()
      .execute();
      
    return optionTypes.map(row => row.option_set_type);
  }

  /**
   * Initialize options for a new organization (copy all archetype templates)
   */
  static async initializeOrganizationOptions(
    kysely: Kysely<any>,
    orgId: string
  ): Promise<void> {
    console.log(`[ArchetypeOptions] Initializing all options for new org ${orgId}`);
    
    const archetypes = await this.getAvailableArchetypes(kysely);
    
    for (const archetype of archetypes) {
      await this.ensureArchetypeOptions(kysely, orgId, archetype);
    }
    
    console.log(`[ArchetypeOptions] Completed initialization for org ${orgId}`);
  }
}