/**
 * Lore & Canon Collection Manager
 * 
 * Manages the automatic creation and management of lore and canon collections
 * for Universe, World (Organization), and Project entities.
 */

import type { Kysely } from 'kysely';

export interface LoreCanonCollections {
  loreCollectionId: string;
  canonCollectionId: string;
}

export class LoreCanonCollectionManager {
  constructor(private kysely: Kysely<any>) {}

  /**
   * Auto-create lore and canon collections for Universe entities
   */
  async createUniverseCollections(
    orgId: string, 
    universeId: string, 
    userId?: string
  ): Promise<LoreCanonCollections> {
    const loreCollectionId = crypto.randomUUID();
    const canonCollectionId = crypto.randomUUID();

    // Create lore collection
    await this.createCollection(orgId, {
      id: loreCollectionId,
      name: `Universe Lore`,
      description: 'Core life values, mission, and emotional foundations',
      collection_type: 'universe_lore',
      owner_id: userId,
      created_by: userId
    });

    // Create canon collection  
    await this.createCollection(orgId, {
      id: canonCollectionId,
      name: `Universe Canon`,
      description: 'Life standards, boundaries, and operational rules',
      collection_type: 'universe_canon',
      owner_id: userId,
      created_by: userId
    });

    return { loreCollectionId, canonCollectionId };
  }

  /**
   * Auto-create lore and canon collections for World (Organization) entities
   */
  async createWorldCollections(
    orgId: string, 
    worldId: string, 
    worldName: string,
    userId?: string
  ): Promise<LoreCanonCollections> {
    const loreCollectionId = crypto.randomUUID();
    const canonCollectionId = crypto.randomUUID();

    // Create lore collection
    await this.createCollection(orgId, {
      id: loreCollectionId,
      name: `${worldName} - Lore`,
      description: 'Purpose, culture, and why this world matters',
      collection_type: 'world_lore',
      owner_id: userId,
      created_by: userId
    });

    // Create canon collection
    await this.createCollection(orgId, {
      id: canonCollectionId,
      name: `${worldName} - Canon`, 
      description: 'Rules, processes, and how things work in this world',
      collection_type: 'world_canon',
      owner_id: userId,
      created_by: userId
    });

    return { loreCollectionId, canonCollectionId };
  }

  /**
   * Auto-create lore and canon collections for Project entities
   */
  async createProjectCollections(
    orgId: string, 
    projectId: string, 
    projectName: string,
    userId?: string
  ): Promise<LoreCanonCollections> {
    const loreCollectionId = crypto.randomUUID();
    const canonCollectionId = crypto.randomUUID();

    // Create lore collection
    await this.createCollection(orgId, {
      id: loreCollectionId,
      name: `${projectName} - Lore`,
      description: 'Project vision, goals, and definition of success',
      collection_type: 'project_lore',
      owner_id: userId,
      created_by: userId
    });

    // Create canon collection
    await this.createCollection(orgId, {
      id: canonCollectionId,
      name: `${projectName} - Canon`,
      description: 'Requirements, constraints, and acceptance criteria', 
      collection_type: 'project_canon',
      owner_id: userId,
      created_by: userId
    });

    return { loreCollectionId, canonCollectionId };
  }

  /**
   * Generic collection creation helper
   */
  private async createCollection(orgId: string, collectionData: any): Promise<void> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_collection`.toLowerCase();
    
    // Exclude relationship fields (owner_id, created_by) - they don't have database columns
    const collectionRecord = {
      id: collectionData.id,
      organization_id: orgId,
      name: collectionData.name,
      description: collectionData.description,
      collection_type: collectionData.collection_type,
      items: JSON.stringify([]),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await this.kysely
      .insertInto(tableName as any)
      .values(collectionRecord)
      .execute();
  }

  /**
   * Get collections for a specific entity
   */
  async getEntityCollections(
    orgId: string,
    entityType: 'universe' | 'world' | 'project',
    entityId: string
  ): Promise<{ lore?: any, canon?: any }> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_collection`.toLowerCase();
    
    const loreType = `${entityType}_lore`;
    const canonType = `${entityType}_canon`;

    const collections = await this.kysely
      .selectFrom(tableName as any)
      .selectAll()
      .where('collection_type', 'in', [loreType, canonType])
      .execute();

    return {
      lore: collections.find(c => c.collection_type === loreType),
      canon: collections.find(c => c.collection_type === canonType)
    };
  }

  /**
   * Add document to a lore or canon collection
   */
  async addDocumentToCollection(
    orgId: string,
    collectionId: string, 
    documentId: string
  ): Promise<void> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_collection`.toLowerCase();
    
    // Get current items
    const collection = await this.kysely
      .selectFrom(tableName as any)
      .select('items')
      .where('id', '=', collectionId)
      .executeTakeFirst();

    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    // Add document ID to items array
    const items = JSON.parse(collection.items || '[]');
    if (!items.includes(documentId)) {
      items.push(documentId);
      
      await this.kysely
        .updateTable(tableName as any)
        .set({ 
          items: JSON.stringify(items),
          updated_at: new Date()
        })
        .where('id', '=', collectionId)
        .execute();
    }
  }

  /**
   * Remove document from a collection
   */
  async removeDocumentFromCollection(
    orgId: string,
    collectionId: string,
    documentId: string
  ): Promise<void> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_collection`.toLowerCase();
    
    // Get current items
    const collection = await this.kysely
      .selectFrom(tableName as any)
      .select('items')
      .where('id', '=', collectionId)
      .executeTakeFirst();

    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    // Remove document ID from items array
    const items = JSON.parse(collection.items || '[]');
    const filteredItems = items.filter((id: string) => id !== documentId);
    
    await this.kysely
      .updateTable(tableName as any)
      .set({ 
        items: JSON.stringify(filteredItems),
        updated_at: new Date()
      })
      .where('id', '=', collectionId)
      .execute();
  }

  /**
   * Get documents in a collection
   */
  async getCollectionDocuments(
    orgId: string,
    collectionId: string
  ): Promise<any[]> {
    const collectionTableName = `org_${orgId.replace(/-/g, '_')}_collection`.toLowerCase();
    const documentTableName = `org_${orgId.replace(/-/g, '_')}_document`.toLowerCase();
    
    // Get collection items
    const collection = await this.kysely
      .selectFrom(collectionTableName as any)
      .select('items')
      .where('id', '=', collectionId)
      .executeTakeFirst();

    if (!collection) {
      return [];
    }

    const documentIds = JSON.parse(collection.items || '[]');
    if (documentIds.length === 0) {
      return [];
    }

    // Get documents
    const documents = await this.kysely
      .selectFrom(documentTableName as any)
      .selectAll()
      .where('id', 'in', documentIds)
      .orderBy('created_at', 'desc')
      .execute();

    return documents;
  }

  /**
   * Update project collection IDs after project creation
   */
  async updateProjectCollections(
    orgId: string,
    projectId: string,
    loreCollectionId: string,
    canonCollectionId: string,
    entityName: string
  ): Promise<void> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}`;
    
    await this.kysely
      .updateTable(tableName as any)
      .set({
        lore_collection_id: loreCollectionId,
        canon_collection_id: canonCollectionId,
        updated_at: new Date()
      })
      .where('id', '=', projectId)
      .execute();
  }
}