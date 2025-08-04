import { ChangeHistory } from '@repo/dataforge/server-entities';
import { BaseServerRepository } from './BaseServerRepository.js';
import { NeonService } from '../lib/neon-orm/neon-service.js';

/**
 * Change history repository with server-specific query methods.
 * Handles change history operations including filtering by entity and user.
 */
export class ChangeHistoryRepository extends BaseServerRepository<ChangeHistory> {
  constructor(neonService: NeonService) {
    super(neonService, ChangeHistory as any);
  }

  /**
   * Find change history entries for a specific entity
   * @param entityType - The type of entity (e.g., 'task', 'project')
   * @param entityId - The ID of the entity
   * @returns Array of change history entries
   */
  async findByEntity(entityType: string, entityId: string): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .where('changeHistory.entityType = :entityType', { entityType })
      .andWhere('changeHistory.entityId = :entityId', { entityId })
      .orderBy('changeHistory.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find change history entries by user
   * @param userId - The ID of the user who made the changes
   * @returns Array of change history entries
   */
  async findByUser(userId: string): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .where('changeHistory.userId = :userId', { userId })
      .orderBy('changeHistory.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find recent change history entries
   * @param limit - Maximum number of entries to return
   * @returns Array of change history entries
   */
  async findRecent(limit: number = 50): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .orderBy('changeHistory.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Get the latest LSN (Log Sequence Number) from change history
   * @returns The latest LSN or null if no changes exist
   */
  async getLatestLSN(): Promise<string | null> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    const result = await queryBuilder
      .select('MAX(changeHistory.lsn)', 'maxLsn')
      .getRawOne();
    return result?.maxLsn || null;
  }

  /**
   * Find changes after a specific LSN
   * @param lsn - The LSN to search after
   * @param limit - Maximum number of changes to return
   * @returns Array of change history entries
   */
  async findChangesAfterLSN(lsn: string, limit: number = 1000): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .where('changeHistory.lsn > :lsn', { lsn })
      .orderBy('changeHistory.lsn', 'ASC')
      .limit(limit)
      .getMany();
  }

  /**
   * Find changes between two LSNs
   * @param startLsn - The starting LSN (exclusive)
   * @param endLsn - The ending LSN (inclusive)
   * @returns Array of change history entries
   */
  async findChangesBetweenLSN(startLsn: string, endLsn: string): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .where('changeHistory.lsn > :startLsn AND changeHistory.lsn <= :endLsn', { startLsn, endLsn })
      .orderBy('changeHistory.lsn', 'ASC')
      .getMany();
  }

  /**
   * Bulk insert multiple change history entries
   * @param changes - Array of change history entries to insert
   * @returns The inserted changes
   */
  async bulkInsertChanges(changes: Partial<ChangeHistory>[]): Promise<ChangeHistory[]> {
    if (changes.length === 0) return [];
    
    // Use TypeORM's insert method for bulk operations
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    const result = await queryBuilder
      .insert()
      .into(ChangeHistory)
      .values(changes)
      .execute();
    
    // Return the inserted entities
    const insertedIds = result.identifiers.map((id: any) => id.id);
    return await this.findByIds(insertedIds);
  }

  /**
   * Find changes by array of IDs
   * @param ids - Array of change IDs
   * @returns Array of change history entries
   */
  override async findByIds(ids: string[]): Promise<ChangeHistory[]> {
    if (ids.length === 0) return [];
    
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .whereInIds(ids)
      .getMany();
  }
}
