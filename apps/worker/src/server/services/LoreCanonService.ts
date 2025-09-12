/**
 * Lore and Canon System Entity Service
 * 
 * Manages semantic knowledge entities for AI-powered knowledge management.
 * These are system entities (like User) that provide clear semantic meaning
 * for AI extensions and context understanding.
 */

import { Kysely } from 'kysely';
import type { Database } from '../lib/kysely';
import type { 
  LoreEntity, 
  CanonEntity, 
  CreateLoreRequest, 
  CreateCanonRequest,
  UpdateLoreRequest,
  UpdateCanonRequest,
  LoreCanonQuery 
} from '../types/lore-canon-entities';

export class LoreCanonService {
  constructor(private db: Kysely<Database>) {}

  // ==========================================
  // LORE OPERATIONS
  // ==========================================

  async createLore(organizationId: string, data: CreateLoreRequest, userId?: string): Promise<LoreEntity> {
    const lore = await this.db
      .insertInto('lore')
      .values({
        organization_id: organizationId,
        title: data.title,
        content: data.content,
        parent_entity_type: data.parent_entity_type,
        parent_entity_id: data.parent_entity_id,
        cultural_significance: data.cultural_significance ?? 50,
        emotional_resonance: data.emotional_resonance ?? 'grounding',
        purpose_clarity: data.purpose_clarity ?? 50,
        alignment_score: data.alignment_score ?? 50,
        created_by: userId,
        ai_usage_count: 0
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return lore as LoreEntity;
  }

  async getLoreById(organizationId: string, loreId: string): Promise<LoreEntity | null> {
    const lore = await this.db
      .selectFrom('lore')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('id', '=', loreId)
      .executeTakeFirst();

    return (lore as LoreEntity) || null;
  }

  async getLoreByParent(
    organizationId: string, 
    parentType: string, 
    parentId: string,
    query?: LoreCanonQuery
  ): Promise<LoreEntity[]> {
    let qb = this.db
      .selectFrom('lore')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('parent_entity_type', '=', parentType as any)
      .where('parent_entity_id', '=', parentId);

    // Apply ordering
    const orderBy = query?.order_by ?? 'created_at';
    const orderDirection = query?.order_direction ?? 'desc';
    qb = qb.orderBy(orderBy as any, orderDirection);

    // Apply pagination
    if (query?.limit) {
      qb = qb.limit(query.limit);
    }
    if (query?.offset) {
      qb = qb.offset(query.offset);
    }

    const lore = await qb.execute();
    return lore as LoreEntity[];
  }

  async updateLore(organizationId: string, loreId: string, data: Partial<UpdateLoreRequest>): Promise<LoreEntity> {
    const lore = await this.db
      .updateTable('lore')
      .set({
        ...(data.title && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.cultural_significance !== undefined && { cultural_significance: data.cultural_significance }),
        ...(data.emotional_resonance && { emotional_resonance: data.emotional_resonance }),
        ...(data.purpose_clarity !== undefined && { purpose_clarity: data.purpose_clarity }),
        ...(data.alignment_score !== undefined && { alignment_score: data.alignment_score }),
      })
      .where('organization_id', '=', organizationId)
      .where('id', '=', loreId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return lore as LoreEntity;
  }

  async deleteLore(organizationId: string, loreId: string): Promise<void> {
    await this.db
      .deleteFrom('lore')
      .where('organization_id', '=', organizationId)
      .where('id', '=', loreId)
      .execute();
  }

  // ==========================================
  // CANON OPERATIONS
  // ==========================================

  async createCanon(organizationId: string, data: CreateCanonRequest, userId?: string): Promise<CanonEntity> {
    const canon = await this.db
      .insertInto('canon')
      .values({
        organization_id: organizationId,
        title: data.title,
        content: data.content,
        parent_entity_type: data.parent_entity_type,
        parent_entity_id: data.parent_entity_id,
        rule_type: data.rule_type ?? 'guideline',
        enforcement_level: data.enforcement_level ?? 'should',
        violation_consequence: data.violation_consequence,
        compliance_level: data.compliance_level ?? 80,
        alignment_score: data.alignment_score ?? 50,
        created_by: userId,
        ai_usage_count: 0
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return canon as CanonEntity;
  }

  async getCanonById(organizationId: string, canonId: string): Promise<CanonEntity | null> {
    const canon = await this.db
      .selectFrom('canon')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('id', '=', canonId)
      .executeTakeFirst();

    return (canon as CanonEntity) || null;
  }

  async getCanonByParent(
    organizationId: string, 
    parentType: string, 
    parentId: string,
    query?: LoreCanonQuery
  ): Promise<CanonEntity[]> {
    let qb = this.db
      .selectFrom('canon')
      .selectAll()
      .where('organization_id', '=', organizationId)
      .where('parent_entity_type', '=', parentType as any)
      .where('parent_entity_id', '=', parentId);

    // Apply ordering
    const orderBy = query?.order_by ?? 'created_at';
    const orderDirection = query?.order_direction ?? 'desc';
    qb = qb.orderBy(orderBy as any, orderDirection);

    // Apply pagination
    if (query?.limit) {
      qb = qb.limit(query.limit);
    }
    if (query?.offset) {
      qb = qb.offset(query.offset);
    }

    const canon = await qb.execute();
    return canon as CanonEntity[];
  }

  async updateCanon(organizationId: string, canonId: string, data: Partial<UpdateCanonRequest>): Promise<CanonEntity> {
    const canon = await this.db
      .updateTable('canon')
      .set({
        ...(data.title && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.rule_type && { rule_type: data.rule_type }),
        ...(data.enforcement_level && { enforcement_level: data.enforcement_level }),
        ...(data.violation_consequence !== undefined && { violation_consequence: data.violation_consequence }),
        ...(data.compliance_level !== undefined && { compliance_level: data.compliance_level }),
        ...(data.alignment_score !== undefined && { alignment_score: data.alignment_score }),
      })
      .where('organization_id', '=', organizationId)
      .where('id', '=', canonId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return canon as CanonEntity;
  }

  async deleteCanon(organizationId: string, canonId: string): Promise<void> {
    await this.db
      .deleteFrom('canon')
      .where('organization_id', '=', organizationId)
      .where('id', '=', canonId)
      .execute();
  }

  // ==========================================
  // COMBINED OPERATIONS
  // ==========================================

  async getLoreAndCanonByParent(
    organizationId: string,
    parentType: string,
    parentId: string,
    query?: LoreCanonQuery
  ): Promise<{ lore: LoreEntity[], canon: CanonEntity[] }> {
    const [lore, canon] = await Promise.all([
      this.getLoreByParent(organizationId, parentType, parentId, query),
      this.getCanonByParent(organizationId, parentType, parentId, query)
    ]);

    return { lore, canon };
  }

  async getKnowledgeStats(organizationId: string, parentType?: string, parentId?: string): Promise<{
    lore_count: number;
    canon_count: number;
    avg_alignment_score: number;
    total_ai_usage: number;
  }> {
    let loreQb = this.db.selectFrom('lore').where('organization_id', '=', organizationId);
    let canonQb = this.db.selectFrom('canon').where('organization_id', '=', organizationId);

    if (parentType && parentId) {
      loreQb = loreQb.where('parent_entity_type', '=', parentType as any).where('parent_entity_id', '=', parentId);
      canonQb = canonQb.where('parent_entity_type', '=', parentType as any).where('parent_entity_id', '=', parentId);
    }

    const [loreStats, canonStats] = await Promise.all([
      loreQb.select(({ fn }) => [
        fn.count<number>('id').as('count'),
        fn.avg<number>('alignment_score').as('avg_alignment'),
        fn.sum<number>('ai_usage_count').as('total_usage')
      ]).executeTakeFirst(),
      canonQb.select(({ fn }) => [
        fn.count<number>('id').as('count'),
        fn.avg<number>('alignment_score').as('avg_alignment'),
        fn.sum<number>('ai_usage_count').as('total_usage')
      ]).executeTakeFirst()
    ]);

    return {
      lore_count: Number(loreStats?.count || 0),
      canon_count: Number(canonStats?.count || 0),
      avg_alignment_score: Math.round(((loreStats?.avg_alignment || 0) + (canonStats?.avg_alignment || 0)) / 2),
      total_ai_usage: Number((loreStats?.total_usage || 0) + (canonStats?.total_usage || 0))
    };
  }

  // ==========================================
  // AI CONTEXT HELPERS
  // ==========================================

  async incrementAIUsage(organizationId: string, entityType: 'lore' | 'canon', entityId: string): Promise<void> {
    if (entityType === 'lore') {
      await this.db
        .updateTable('lore')
        .set({ ai_usage_count: (eb) => eb('ai_usage_count', '+', 1) })
        .where('organization_id', '=', organizationId)
        .where('id', '=', entityId)
        .execute();
    } else {
      await this.db
        .updateTable('canon')
        .set({ ai_usage_count: (eb) => eb('ai_usage_count', '+', 1) })
        .where('organization_id', '=', organizationId)
        .where('id', '=', entityId)
        .execute();
    }
  }
}